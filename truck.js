/**
 * Dependencies.
 */
var spawn = require('child_process').spawn;
var fs = require('fs');

/**
 * Just a slightly more convienent loader than require().
 */
load = function(name) {
	return require(__dirname + '/lib/' + name + '.js');
};

var Truck = function() {

	/* Loads configuration from config.js, using /lib/config.js to provide default behavior. */
	var Config = load('config');
	Config = new Config(__dirname + '/config.js');

	/**
	 * Returns a generated shell script as a string.
	 *
	 * env       String    Name of environment.
	 * server    String    Uses to lookup and generate environment variables.
	 * action    String    Action to execute.
	 */
	var generateScript = function(env, server, action) {

		var origins = Config.for(env).sources;

		var script = '';

		/* include all of the bash scripts, concatenated together. */
		for (var i = 0; i < origins.length; i++) {
			var conf = Config.for(env, origins[i]);

			var filename = __dirname + '/scripts/' + conf.type + '.' + action;

			script += Config.generateScript(env, conf);
			
			if (fs.existsSync(filename + '.pre.sh')) {
				script += fs.readFileSync(filename + '.pre.sh') + "\n";
			}
			if (fs.existsSync(filename + '.sh')) {
				script += fs.readFileSync(filename + '.sh') + "\n";
			}
			if (fs.existsSync(filename + '.post.sh')) {
				script += fs.readFileSync(filename + '.post.sh') + "\n";
			}
		}

		return script;
	};

	/**
	 * Executes a script remotely by starting ssh and piping the script into it.
	 *
	 * server    String    connection string.
	 * script    String    contents of script to run.
	 * callback  Function  executing after script is completed.
	 */
	var runScript = function(server, script, callback) {
		var proc = spawn('ssh', [ '-T', server, 'bash' ]);
		proc.stdin.end(script);
		proc.stdout.on('data', function(data) { console.log((server + ': ' + data).trim()); });
		proc.stderr.on('data', function(data) { console.log((server + ': ' + data).trim()); });

		proc.on('exit', function(code, signal) {
			if (code == 0) {
				if (typeof(callback) == 'function') {
					callback();
				}
			} else {
				process.exit(code);
			}
		});
	};

	/**
	 * Recursive function that queues scripts and runs them in order, in parallel.
	 *
	 * env       String    Environment.
	 * actions   Array     Array of actions to perform.
	 */
	var runActions = function(env, actions) {
		if (actions.length == 0) {
			return;
		}

		var hosts = Config.for(env).hosts;
		var action = actions.shift();

		var processes = 0;

		console.log('= running action', action, '=');

		for (var i = 0; i < hosts.length; i++) {
			var host = Config.for(env).servers[hosts[i]];
			var script = generateScript(env, host, action);

			processes++;
			runScript(host, script, function() {
				processes--;
				if (processes == 0) {
					runActions(env, actions);
				}
			});
		}
	};

	/**
	 * Placeholder - just queues and runs these four actions. This may be good enough,
	 * but in all liklihood we'll want to make this configurable and such.
	 */
	this.deploy = function(env) {
		runActions(env, ['validate', 'export', 'migrate', 'replace']);
	};
};

/**
 * Arguments handling, to handle being called directly (./truck.js ...) or with node
 * (node ./truck.js ...).
 */
var args = process.argv;
if (args.length > 1 && args[1].match(__filename)) {
	args = args.slice(2);
} else if (args.length && args[0].match(__filename)) {
	args = args.slice(1);
} else {
	//show help
	console.log("You need help.");
}

/**
 * Placeholder - we'll want to make this more flexible, but for now its hard coded to expect the ENV
 * as the one and only argument, and to always deploy.
 */
var t = new Truck();
t.deploy(args[0]);
