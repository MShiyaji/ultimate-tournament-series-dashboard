"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchCachedBasicTournaments = fetchCachedBasicTournaments;
// scripts/cacheDailyTournaments.ts
var date_fns_1 = require("date-fns");
var dotenv = require("dotenv");
var client_s3_1 = require("@aws-sdk/client-s3");
dotenv.config({ path: ".env" });
var API_URL = "https://api.start.gg/gql/alpha";
var STARTGG_API_KEYS = (process.env.STARTGG_API_KEYS || process.env.STARTGG_API_KEY || "")
    .split(",")
    .map(function (k) { return k.trim(); })
    .filter(Boolean);
var s3 = new client_s3_1.S3Client({
    region: "us-east-2", // or your region
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
var BUCKET_NAME = "ultimate-tournament-data";
var CACHE_KEY = "basic-cache.json";
var basicQuery = "\n  query BasicTournamentInfo($startTimestamp: Timestamp!, $endTimestamp: Timestamp!, $page: Int!) {\n    tournaments(query: {\n      perPage: 100\n      page: $page\n      filter: {\n        afterDate: $startTimestamp\n        beforeDate: $endTimestamp\n        videogameIds: [1386]\n      }\n    }) {\n      pageInfo {\n        totalPages\n      }\n      nodes {\n        id\n        name\n        slug\n        startAt\n        primaryContact\n        city\n        countryCode\n        events(filter: { videogameId: 1386 }) {\n          id\n          name\n          numEntrants\n        }\n      }\n    }\n  }\n";
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
function createAdaptiveDelay(initial, min, max, step) {
    if (initial === void 0) { initial = 200; }
    if (min === void 0) { min = 0; }
    if (max === void 0) { max = 5000; }
    if (step === void 0) { step = 100; }
    var delayMs = initial;
    return {
        wait: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!(delayMs > 0)) return [3 /*break*/, 2];
                            return [4 /*yield*/, delay(delayMs)];
                        case 1:
                            _a.sent();
                            _a.label = 2;
                        case 2: return [2 /*return*/];
                    }
                });
            });
        },
        increase: function () {
            delayMs = Math.min(max, delayMs + step);
        },
        decrease: function () {
            delayMs = Math.max(min, delayMs - step);
        },
        get value() {
            return delayMs;
        }
    };
}
function fetchFromAPI(query_1, variables_1, apiKey_1) {
    return __awaiter(this, arguments, void 0, function (query, variables, apiKey, retries) {
        var _loop_1, attempt, state_1;
        if (retries === void 0) { retries = 3; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _loop_1 = function (attempt) {
                        var controller_1, timeoutId, response, errorText, data, error_1;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 7, , 9]);
                                    controller_1 = new AbortController();
                                    timeoutId = setTimeout(function () { return controller_1.abort(); }, 30000);
                                    return [4 /*yield*/, fetch(API_URL, {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json",
                                                Authorization: "Bearer ".concat(apiKey),
                                            },
                                            body: JSON.stringify({ query: query, variables: variables }),
                                            signal: controller_1.signal
                                        })];
                                case 1:
                                    response = _b.sent();
                                    clearTimeout(timeoutId);
                                    if (!!response.ok) return [3 /*break*/, 5];
                                    return [4 /*yield*/, response.text()];
                                case 2:
                                    errorText = _b.sent();
                                    if (!(response.status === 429)) return [3 /*break*/, 4];
                                    console.log("\u26A0\uFE0F Rate limit hit, waiting longer before retry (attempt ".concat(attempt, "/").concat(retries, ")"));
                                    return [4 /*yield*/, delay(10000 * attempt)];
                                case 3:
                                    _b.sent(); // Progressive backoff
                                    return [2 /*return*/, "continue"];
                                case 4: throw new Error("API request failed with status ".concat(response.status, ": ").concat(errorText));
                                case 5: return [4 /*yield*/, response.json()];
                                case 6:
                                    data = _b.sent();
                                    if (data.errors)
                                        throw new Error(data.errors.map(function (e) { return e.message; }).join(", "));
                                    return [2 /*return*/, { value: data.data }];
                                case 7:
                                    error_1 = _b.sent();
                                    if (error_1.name === 'AbortError') {
                                        console.log("\u23F1\uFE0F Request timed out (attempt ".concat(attempt, "/").concat(retries, ")"));
                                    }
                                    else {
                                        console.error("\u274C API error (attempt ".concat(attempt, "/").concat(retries, "):"), error_1.message);
                                    }
                                    if (attempt === retries)
                                        throw error_1;
                                    // Add exponential backoff
                                    return [4 /*yield*/, delay(Math.min(2000 * Math.pow(2, attempt), 30000))];
                                case 8:
                                    // Add exponential backoff
                                    _b.sent();
                                    return [3 /*break*/, 9];
                                case 9: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _a.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Download
function downloadCache() {
    return __awaiter(this, void 0, void 0, function () {
        var command, response, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    command = new client_s3_1.GetObjectCommand({ Bucket: BUCKET_NAME, Key: CACHE_KEY });
                    return [4 /*yield*/, s3.send(command)];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.Body.transformToString()];
                case 2:
                    text = _a.sent();
                    return [2 /*return*/, JSON.parse(text)];
            }
        });
    });
}
// Upload
function uploadCache(data) {
    return __awaiter(this, void 0, void 0, function () {
        var command;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    command = new client_s3_1.PutObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: CACHE_KEY,
                        Body: JSON.stringify(data),
                        ContentType: "application/json",
                    });
                    return [4 /*yield*/, s3.send(command)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function fetchCachedBasicTournaments() {
    return __awaiter(this, void 0, void 0, function () {
        var cacheData, error_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, downloadCache()];
                case 1:
                    cacheData = _b.sent();
                    // Extract the tournaments array from the cache structure
                    return [2 /*return*/, ((_a = cacheData === null || cacheData === void 0 ? void 0 : cacheData.tournaments) === null || _a === void 0 ? void 0 : _a.nodes) || []];
                case 2:
                    error_2 = _b.sent();
                    console.error("❌ Failed to read from S3 cache:", error_2);
                    throw new Error("Failed to load cached tournaments");
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Helper to rotate API keys
function getApiKeyRotator(keys) {
    var idx = 0;
    return function () {
        var key = keys[idx];
        idx = (idx + 1) % keys.length;
        return key;
    };
}
function cacheBasicTournaments() {
    return __awaiter(this, void 0, void 0, function () {
        // 2. Split dateChunks among API keys
        function chunkArray(array, n) {
            var chunks = Array.from({ length: n }, function () { return []; });
            array.forEach(function (item, i) {
                chunks[i % n].push(item);
            });
            return chunks;
        }
        var existingTournaments, startFromScratch, error_3, startDate, endDate, chunkSizeDays, existingIds, newTournaments, dateChunks, currentStart, currentEnd, dateChunkGroups, tournamentMap, _i, existingTournaments_1, tournament, _a, newTournaments_1, tournament, basicTournaments, cacheData, uploadError_1, fs;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    existingTournaments = [];
                    startFromScratch = false;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fetchCachedBasicTournaments()];
                case 2:
                    existingTournaments = _b.sent();
                    // Verify we got an array back
                    if (!Array.isArray(existingTournaments)) {
                        console.log("⚠️ Cache returned non-array data. Treating as empty array.");
                        existingTournaments = [];
                        startFromScratch = true;
                    }
                    else {
                        console.log("\uD83D\uDCCA Found existing cache with ".concat(existingTournaments.length, " tournaments"));
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _b.sent();
                    console.log("ℹ️ No existing cache found or error accessing it. Creating from scratch.");
                    startFromScratch = true;
                    return [3 /*break*/, 4];
                case 4:
                    endDate = new Date();
                    if (startFromScratch) {
                        startDate = new Date("2018-01-01");
                        console.log("🔄 Building complete cache from 2018 to present");
                    }
                    else {
                        startDate = new Date();
                        startDate.setDate(startDate.getDate() - 2);
                        startDate.setHours(0, 0, 0, 0);
                        console.log("\uD83D\uDD04 Updating cache with tournaments from ".concat(startDate.toLocaleDateString()));
                    }
                    chunkSizeDays = startFromScratch ? 21 : 1;
                    existingIds = new Set(existingTournaments.map(function (t) { return t.id; }));
                    newTournaments = [];
                    dateChunks = [];
                    currentStart = startDate;
                    while (currentStart < endDate) {
                        currentEnd = (0, date_fns_1.addDays)(currentStart, chunkSizeDays);
                        dateChunks.push({
                            start: new Date(currentStart),
                            end: currentEnd > endDate ? new Date(endDate) : new Date(currentEnd),
                        });
                        currentStart = currentEnd > endDate ? endDate : currentEnd;
                    }
                    dateChunkGroups = chunkArray(dateChunks, STARTGG_API_KEYS.length);
                    // 3. Process each group in parallel, one per API key
                    return [4 /*yield*/, Promise.all(dateChunkGroups.map(function (chunks, idx) { return __awaiter(_this, void 0, void 0, function () {
                            var apiKey, _i, chunks_1, _a, start, end, chunkStartTimestamp, chunkEndTimestamp, page, totalPages, result, tournaments, _b, tournaments_1, tournament, error_4;
                            var _c, _d, _e;
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        apiKey = STARTGG_API_KEYS[idx];
                                        _i = 0, chunks_1 = chunks;
                                        _f.label = 1;
                                    case 1:
                                        if (!(_i < chunks_1.length)) return [3 /*break*/, 10];
                                        _a = chunks_1[_i], start = _a.start, end = _a.end;
                                        chunkStartTimestamp = Math.floor(start.getTime() / 1000);
                                        chunkEndTimestamp = Math.floor(end.getTime() / 1000);
                                        page = 1;
                                        totalPages = 1;
                                        _f.label = 2;
                                    case 2:
                                        // Add a heartbeat log to prevent timeouts
                                        if (page % 3 === 0) {
                                            console.log("\uD83D\uDC93 Still processing - Key ".concat(idx + 1, ", Page ").concat(page, "/").concat(totalPages));
                                        }
                                        return [4 /*yield*/, delay(1000)];
                                    case 3:
                                        _f.sent();
                                        _f.label = 4;
                                    case 4:
                                        _f.trys.push([4, 6, , 8]);
                                        return [4 /*yield*/, fetchFromAPI(basicQuery, {
                                                startTimestamp: chunkStartTimestamp,
                                                endTimestamp: chunkEndTimestamp,
                                                page: page,
                                            }, apiKey)];
                                    case 5:
                                        result = _f.sent();
                                        tournaments = ((_c = result === null || result === void 0 ? void 0 : result.tournaments) === null || _c === void 0 ? void 0 : _c.nodes) || [];
                                        totalPages = ((_e = (_d = result === null || result === void 0 ? void 0 : result.tournaments) === null || _d === void 0 ? void 0 : _d.pageInfo) === null || _e === void 0 ? void 0 : _e.totalPages) || 1;
                                        for (_b = 0, tournaments_1 = tournaments; _b < tournaments_1.length; _b++) {
                                            tournament = tournaments_1[_b];
                                            // Validate the tournament has a valid ID
                                            if (!tournament.id) {
                                                console.warn("⚠️ Skipping tournament without ID:", tournament.name || "Unknown");
                                                continue;
                                            }
                                            // Ensure it's not already in our set (already synchronized for deduplication)
                                            if (!existingIds.has(tournament.id)) {
                                                newTournaments.push(tournament);
                                                existingIds.add(tournament.id); // Immediately mark as processed
                                            }
                                        }
                                        console.log("\u2705 [Key ".concat(idx + 1, "] Page ").concat(page, "/").concat(totalPages, ": Found ").concat(tournaments.length, " tournaments, ").concat(newTournaments.length, " new overall"));
                                        page++;
                                        return [3 /*break*/, 8];
                                    case 6:
                                        error_4 = _f.sent();
                                        console.error("\u274C [Key ".concat(idx + 1, "] Error fetching page ").concat(page, ":"), error_4);
                                        return [4 /*yield*/, delay(5000)];
                                    case 7:
                                        _f.sent();
                                        if (page > 3) {
                                            console.log("⚠️ Skipping to next chunk after multiple failures");
                                            return [3 /*break*/, 9];
                                        }
                                        return [3 /*break*/, 8];
                                    case 8:
                                        if (page <= totalPages) return [3 /*break*/, 2];
                                        _f.label = 9;
                                    case 9:
                                        _i++;
                                        return [3 /*break*/, 1];
                                    case 10: return [2 /*return*/];
                                }
                            });
                        }); }))];
                case 5:
                    // 3. Process each group in parallel, one per API key
                    _b.sent();
                    if (!(newTournaments.length > 0)) return [3 /*break*/, 10];
                    console.log("\uD83D\uDCE6 Found ".concat(newTournaments.length, " new tournaments. Updating cache..."));
                    tournamentMap = new Map();
                    // First add existing tournaments to the map
                    for (_i = 0, existingTournaments_1 = existingTournaments; _i < existingTournaments_1.length; _i++) {
                        tournament = existingTournaments_1[_i];
                        if (tournament.id) {
                            tournamentMap.set(tournament.id, tournament);
                        }
                    }
                    // Then add new tournaments, overwriting any with the same ID
                    for (_a = 0, newTournaments_1 = newTournaments; _a < newTournaments_1.length; _a++) {
                        tournament = newTournaments_1[_a];
                        if (tournament.id) {
                            tournamentMap.set(tournament.id, tournament);
                        }
                    }
                    basicTournaments = Array.from(tournamentMap.values());
                    cacheData = {
                        tournaments: { nodes: basicTournaments }
                    };
                    console.log("\u2139\uFE0F After deduplication: ".concat(basicTournaments.length, " total tournaments (").concat(basicTournaments.length - existingTournaments.length, " added)"));
                    _b.label = 6;
                case 6:
                    _b.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, uploadCache(cacheData)];
                case 7:
                    _b.sent();
                    console.log("\u2705 Cache updated! Now contains ".concat(basicTournaments.length, " tournaments"));
                    return [3 /*break*/, 9];
                case 8:
                    uploadError_1 = _b.sent();
                    console.error("❌ Failed to upload to S3:", uploadError_1);
                    try {
                        fs = require('fs');
                        fs.writeFileSync('./tournament-cache-backup.json', JSON.stringify(cacheData));
                        console.log("⚠️ Saved to local backup file instead: ./tournament-cache-backup.json");
                    }
                    catch (fsError) {
                        console.error("❌ Even local backup failed:", fsError);
                    }
                    return [3 /*break*/, 9];
                case 9: return [3 /*break*/, 11];
                case 10:
                    console.log("ℹ️ No new tournaments found. Cache is up to date.");
                    _b.label = 11;
                case 11: return [2 /*return*/];
            }
        });
    });
}
// Run only if this file is called directly
if (require.main === module) {
    cacheBasicTournaments().catch(function (err) {
        console.error("❌ Script error:", err);
        process.exit(1);
    });
}
