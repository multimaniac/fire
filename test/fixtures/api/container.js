'use strict';

var Q = require('q');
var app = require('./..').app('test');

function unauthenticatedError(authenticator) {
	var error = new Error();

	if(authenticator) {
		error.status = 403;
		error.message = 'Forbidden';
	}
	else {
		error.status = 401;
		error.message = 'Unauthorized';
	}

	return error;
}

// TODO: Move this to a shared location. In the model or access control?
function _canUpdateProperties(propertyNames, model) {
	for(var i = 0, il = propertyNames.length; i < il; i++) {
		var propertyName = propertyNames[i];
		var property = model.getProperty(propertyName);

		// TODO: Implement function-based checks.
		if(property && typeof property.options.canUpdate != 'undefined' && !property.options.canUpdate) {
			return false;
		}
	}

	return true;
}

function ContainerModelController() {

}
app.controller(ContainerModelController);

ContainerModelController.prototype.basePathComponents = ['api'];


ContainerModelController.prototype.createContainer = function() {
	var model = this.models.Container;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.canCreate(authenticator))
				.then(function(canCreate) {
					if(canCreate) {
						var createMap = self.body || {};
						if(model.options.automaticPropertyName) {
							// If a authenticator model does not exists there is some wrong.
							if(!self.models.getAuthenticator()) {
								throw new Error('Cannot find authenticator model. Did you define an authenticator via `PropertyTypes#Authenticate`?');
							}

							// This is definitely a bad request if the user tries to set the automatic property manually.
							if(createMap[model.options.automaticPropertyName]) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							createMap[model.options.automaticPropertyName] = authenticator;
						}

						var createFunction = model.createContainer || model.create;

						return createFunction.call(model, self.body)
							.then(function(instance) {
								if(model.isAuthenticator()) {
									self.session.at = instance.accessToken;
								}

								return instance;
							});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
};

ContainerModelController.prototype.getContainers = function() {
	var model = this.models.Container;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.canRead(authenticator))
				.then(function(canRead) {
					if(canRead) {
						var queryMap = self.query || {};
						var optionsMap = {};

						if(queryMap.$options) {
							optionsMap = queryMap.$options;
							delete queryMap.$options;
						}

						var readManyFunction = model.getContainers || model.find;
						return readManyFunction.call(model, queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
};

ContainerModelController.prototype.getContainer = function($id) {
	var model = this.models.Container;
	var accessControl = model.getAccessControl();

	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.canRead(authenticator))
				.then(function(canRead) {
					if(canRead) {
						var readFunction = model.getContainer || model.getOne;

						// TODO: read should also use all query params as additional where options
						return readFunction.call(model, {id: $id});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
};

ContainerModelController.prototype.updateContainer = function($id) {
	var model = this.models.Container;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.getPermissionFunction('update')(authenticator))
				.then(function(canUpdate) {
					if(canUpdate) {
						var whereMap = {};

						var keyPath = accessControl.getPermissionKeyPath('update');
						if(keyPath) {
							if(!model.getProperty(keyPath)) {
								throw new Error('Invalid key path `' + keyPath + '`.');
							}

							// TODO: We need a way to resolve a key path if it references child properties via the dot syntax e.g. team.clients.
							whereMap[keyPath] = authenticator;
						}

						if(model.options.automaticPropertyName) {
							whereMap[model.options.automaticPropertyName] = authenticator;
						}

						whereMap.id = $id;

						// Now check if we may update the properties we want to update.
						return Q.when(_canUpdateProperties(Object.keys(self.body), model))
							.then(function(canUpdateProperties) {
								if(canUpdateProperties) {
									var updateFunction = model.updateContainer || model.update;
									return updateFunction.call(model, whereMap, self.body)
										.then(function(instance) {
											if(instance) {
												return instance;
											}
											else {
												throw unauthenticatedError(authenticator);
											}
										});
								}
								else {
									var error = new Error();
									error.status = 400;
									error.message = 'Bad Request';
									throw error;
								}
							});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		})
		.catch(function(error) {
			throw error;
		});
};

ContainerModelController.prototype.deleteContainer = function($id) { //jshint ignore:line
	var error = new Error('Not Found');
	error.status = 404;
	throw error;
};













ContainerModelController.prototype.getUsers = ['/api/Containers/:id/users', function($id) {
	var model = this.models.Container;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.canRead(authenticator))
				.then(function(canRead) {
					if(canRead) {
						var queryMap = self.query || {};
						var optionsMap = {};

						if(queryMap.$options) {
							optionsMap = queryMap.$options;
							delete queryMap.$options;
						}

						var association = model.getProperty('users');
						queryMap[association.options.relationshipVia.name] = $id;

						return association.options.relationshipVia.model.find(queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
}];

ContainerModelController.prototype.updateUsers = ['/api/Containers/:id/users/:associationID', function($id, $associationID) {
	var model = this.models.Container;
	var accessControl = model.getAccessControl();

	var self = this;
	return this.findAuthenticator()
		.then(function(authenticator) {
			return Q.when(accessControl.getPermissionFunction('update')(authenticator))
				.then(function(canUpdate) {
					if(canUpdate) {
						// TODO: Simply use the model via `this.models.FooBar`
						var association = model.getProperty('users');
						return Q.when(_canUpdateProperties(Object.keys(self.body), association.options.relationshipVia.model))
							.then(function(canUpdateProperties) {
								if(canUpdateProperties) {
									var whereMap = {};

									var keyPath = accessControl.getPermissionKeyPath('update');
									if(keyPath) {
										if(!model.getProperty(keyPath)) {
											throw new Error('Invalid key path `' + keyPath + '`.');
										}

										// TODO: We need a way to resolve a key path if it references child properties via the dot syntax e.g. team.clients.
										whereMap[keyPath] = authenticator;
									}

									// TODO: Retrieve the name in the code generation phase already!
									whereMap[association.options.relationshipVia.name] = $id;
									whereMap.id = $associationID;

									return association.options.relationshipVia.model.updateOne(whereMap, self.body);
								}
								else {
									var error = new Error();
									error.status = 400;
									error.message = 'Bad Request';
									throw error;
								}
							});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
}];

