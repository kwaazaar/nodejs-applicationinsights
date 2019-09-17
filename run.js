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
console.log(`Command: ${cmd}`);
console.log(`Metric key: ${metricKey}`);
console.log(`AI instrumentation key: ${instrumentationKey}`);

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

const procStart = process.hrtime();
const child = spawn(cmd, {
//    stdio: 'inherit',
    shell: true
});

child.on('exit', function (code, signal) {
    if (code !== 0) {
        logError(`Failure: ${code} (signal: ${signal})`);
        trackResult(false);
    } else {
        logMessage(`Success!`);
        trackResult(true);
    }
    return code;
});

child.on('error', function (err) {
    logError(err);
    trackResult(false);
    return 1;
});

// Pipe stdin, just in case
//process.stdin.pipe(child.stdin);

// Stream io
child.stderr.on('data', (data) => logError(data));
child.stdout.on('data', (data) => logMessage(data));

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
