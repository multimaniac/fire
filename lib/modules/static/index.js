'use strict';

exports = module.exports = Static;

var config = require('./../../helpers/config');

var express = require('express');
var path = require('path');

/**
 * Convenience module to route requests to static folders.
 *
 *	- Creates a less middleware on source /styles and destination /public/styles.
 *	- Makes the public folder .. public. All files in public will be accessible.
 *	- Makes _assets available as scripts. The client-side fire.js is generated in _assets.
 *	- Makes bower_components available publicly under the equally named /bower_components path.
 *
 * In production, you should not use this module. But rather, let something like nginx or a CDN handle your static assets. Compiling scripts at runtime in production is also something you should avoid.
 *
 * @param {App} app The app.
 * @constructor
 */
function Static(app) {
	// TODO: Disable this in production. This is only for convenience in development mode.
	this.app = app;
}

/**
 * Starts the static express middlewares.
 *
 * This modules should not be used during production.
 */
Static.prototype.setup = function() {
	this.app.HTTPServer.express.use('/styles', require('less-middleware')(path.join(config.basePath, 'styles'), {
		force: (!process.env.NODE_ENV || process.env.NODE_ENV == 'development'),
		dest: path.join(config.basePath, 'public', 'styles')
	}));
	this.app.HTTPServer.express.use(express.static(path.join(config.basePath, 'public')));
	this.app.HTTPServer.express.use('/scripts', express.static(path.join(config.basePath, '_assets')));
	this.app.HTTPServer.express.use('/bower_components', express.static(path.join(config.basePath, 'bower_components')));
};
