const { spawn, exec } = require('child_process');
const appInsights = require("applicationinsights");

var args = process.argv.slice(2);
if (args.length < 3) {
    console.error('syntax: node run.js instrumentation_key metric-key cmd [arg0..argn]');
    return 3;
}

var instrumentationKey = args[0];
var metricKey = args[1];

// Concat all arguments together as one shell command
var cmd = args.splice(2).join(' ');
// If the command is wrapped in ", unwrap it
if (cmd.startsWith('"') && cmd.endsWith('"')) {
    cmd = cmd.substr(1, cmd.length - 2);
}

let loop = false;
let loopInterval = 5000;
if (process.env.LOOP == "Y") {
    loop = true;
    const loopIntervalEnv = process.env.LOOPINTERVAL;
    if (loopIntervalEnv != null && loopIntervalEnv != "") {
        loopInterval = loopIntervalEnv;
    }
}

console.log(`Command: ${cmd}`);
console.log(`Metric key: ${metricKey}`);
console.log(`AI instrumentation key: ${instrumentationKey}`);
if (loop) {
    console.log(`Looping is enabled (interval: ${loopInterval}ms)`);
}

appInsights.setup(instrumentationKey)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true);
appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = metricKey;
appInsights.start();
const aiClient = appInsights.defaultClient;

let runCount = 0;
let procStart = null;
start();

function childExit(code, signal) {
    if (code !== 0) {
        logError(`Failure: ${code} (signal: ${signal})`);
        trackResult(false);
    } else {
        logMessage(`Success!`);
        trackResult(true);
    }

    restart(code);
}

function childError(err) {
    logError(err);
    trackResult(false);

    restart(1);
}

// Pipe stdin, just in case
//process.stdin.pipe(child.stdin);

function start() {
    runCount++;
    logMessage(`Starting run ${runCount}.`)
    procStart = process.hrtime();
    let child = spawn(cmd, {
    //    stdio: 'inherit',
        shell: true
    });
    child.on('exit', childExit);
    child.on('error', childError);

    // Stream io
    child.stderr.on('data', (data) => logMessage(data.toString('utf8'))); // Log as message, error will be caught by on child.on('error')
    child.stdout.on('data', (data) => logMessage(data.toString('utf8')));
}

async function restart(code) {
    logMessage(`Run ${runCount} finished.`)
    if (loop) {
        await sleep(loopInterval);
        start();
    } else {
        return code;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function logMessage(msg) {
    console.log(msg);
    aiClient.trackTrace({message: msg});
}

function logError(msg) {
    console.error(msg);
    aiClient.trackException({exception: new Error(msg)});
}

function trackResult(success) {
    const duration = process.hrtime(procStart);
    aiClient.trackMetric({name: metricKey, value: success ? 1 : 0});
    aiClient.trackMetric({name: `${metricKey}_duration`, value: duration[0] * 1e9 + duration[1]});
}
