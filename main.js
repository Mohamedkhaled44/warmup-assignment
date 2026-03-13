const fs = require("fs");

//helpers method for easier implementation anD better understanding of the code
function timeToSeconds(timeStr) {

    timeStr = timeStr.trim();

    let [time, period] = timeStr.split(" ");
    let [h, m, s] = time.split(":").map(Number);

    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;

    return h*3600 + m*60 + s;
}

function secondsToTime(seconds){

    let h = Math.floor(seconds / 3600);
    seconds %= 3600;

    let m = Math.floor(seconds / 60);
    let s = seconds % 60;

    return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function durationToSeconds(str){

    let [h,m,s] = str.split(":").map(Number);

    return h*3600 + m*60 + s;
}


// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime,endTime){

    let start = timeToSeconds(startTime);
    let end = timeToSeconds(endTime);

    let diff = end - start;

    return secondsToTime(diff);
}


// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime,endTime){

    let start = timeToSeconds(startTime);
    let end = timeToSeconds(endTime);

    let deliveryStart = 8*3600;
    let deliveryEnd = 22*3600;

    let idle = 0;

    if(start < deliveryStart)
        idle += deliveryStart - start;

    if(end > deliveryEnd)
        idle += end - deliveryEnd;

    return secondsToTime(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration,idleTime){

    let shift = durationToSeconds(shiftDuration);
    let idle = durationToSeconds(idleTime);

    let active = shift - idle;

    return secondsToTime(active);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date,activeTime){

    let active = durationToSeconds(activeTime);

    let quota;

    if(date >= "2025-04-10" && date <= "2025-04-30")
        quota = durationToSeconds("6:00:00");
    else
        quota = durationToSeconds("8:24:00");

    return active >= quota;
}


// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {

    const fs = require("fs");

    let data = fs.readFileSync(textFile, "utf8").trim();

    let rows = data.length ? data.split("\n") : [];

    // check duplicate
    for (let row of rows) {

        let cols = row.split(",");

        let driverID = cols[0];
        let date = cols[2];

        if (driverID === shiftObj.driverID && date === shiftObj.date) {
            return {};
        }
    }

    // calculate fields
    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let quota = metQuota(shiftObj.date, activeTime);

    let newRow = [
        shiftObj.driverID,
        shiftObj.driverName,
        shiftObj.date,
        shiftObj.startTime,
        shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        quota,
        false
    ].join(",");

    // find insert position
    let insertIndex = rows.length;

    for (let i = 0; i < rows.length; i++) {

        let cols = rows[i].split(",");

        if (cols[0] === shiftObj.driverID) {
            insertIndex = i + 1;
        }
    }

    rows.splice(insertIndex, 0, newRow);

    fs.writeFileSync(textFile, rows.join("\n"));

    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: quota,
        hasBonus: false
    };
}


// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {

    const fs = require("fs");

    let data = fs.readFileSync(textFile, "utf8").trim();

    let rows = data.split("\n");

    for (let i = 0; i < rows.length; i++) {

        let cols = rows[i].split(",");

        if (cols[0] === driverID && cols[2] === date) {

            cols[9] = newValue;

            rows[i] = cols.join(",");

            break;
        }
    }

    fs.writeFileSync(textFile, rows.join("\n"));
}


// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {

    const fs = require("fs");

    let data = fs.readFileSync(textFile, "utf8").trim();

    let rows = data.split("\n");

    let count = 0;
    let driverFound = false;

    month = Number(month);

    for (let row of rows) {

        let cols = row.split(",");

        let id = cols[0];
        let date = cols[2];
        let bonus = cols[9];

        if (id === driverID) {

            driverFound = true;

            let recordMonth = Number(date.split("-")[1]);

            if (recordMonth === month && bonus === "true") {
                count++;
            }
        }
    }

    if (!driverFound) {
        return -1;
    }

    return count;
}


// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {

    const fs = require("fs");

    let data = fs.readFileSync(textFile, "utf8").trim();

    let rows = data.split("\n");

    let totalSeconds = 0;

    for (let row of rows) {

        let cols = row.split(",");

        let id = cols[0];
        let date = cols[2];
        let activeTime = cols[7];

        if (id === driverID) {

            let recordMonth = Number(date.split("-")[1]);

            if (recordMonth === month) {

                totalSeconds += durationToSeconds(activeTime);
            }
        }
    }

    return secondsToTime(totalSeconds);
}


// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {

    const fs = require("fs");

    let shiftData = fs.readFileSync(textFile,"utf8").trim();
    let rateData = fs.readFileSync(rateFile,"utf8").trim();

    let shiftRows = shiftData.split("\n");
    let rateRows = rateData.split("\n");

    let dayOff;

    for (let row of rateRows) {

        let cols = row.split(",");

        if (cols[0] === driverID) {
            dayOff = cols[1];
            break;
        }
    }

    let totalSeconds = 0;

    for (let row of shiftRows) {

        let cols = row.split(",");

        let id = cols[0];
        let date = cols[2];

        if (id === driverID) {

            let recordMonth = Number(date.split("-")[1]);

            if (recordMonth === month) {

                let weekday = new Date(date)
                .toLocaleDateString("en-US",{weekday:"long"});

                if (weekday !== dayOff) {

                    let quota;

                    if (date >= "2025-04-10" && date <= "2025-04-30")
                        quota = "6:00:00";
                    else
                        quota = "8:24:00";

                    totalSeconds += durationToSeconds(quota);
                }
            }
        }
    }

    totalSeconds -= bonusCount * 2 * 3600;

    if (totalSeconds < 0) totalSeconds = 0;

    return secondsToTime(totalSeconds);
}


// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {

    const fs = require("fs");

    let data = fs.readFileSync(rateFile,"utf8").trim();

    let rows = data.split("\n");

    let basePay;
    let tier;

    for (let row of rows) {

        let cols = row.split(",");

        if (cols[0] === driverID) {
            basePay = Number(cols[2]);
            tier = Number(cols[3]);
            break;
        }
    }

    let actual = durationToSeconds(actualHours);
    let required = durationToSeconds(requiredHours);

    if (actual >= required) {
        return basePay;
    }

    let missingSeconds = required - actual;

    let missingHours = Math.floor(missingSeconds / 3600);

    let freeHours;

    if (tier === 1) freeHours = 50;
    else if (tier === 2) freeHours = 20;
    else if (tier === 3) freeHours = 10;
    else freeHours = 3;

    let billableHours = missingHours - freeHours;

    if (billableHours < 0) billableHours = 0;

    let deductionRate = Math.floor(basePay / 185);

    let salaryDeduction = billableHours * deductionRate;

    let netPay = basePay - salaryDeduction;

    return netPay;
}


module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
