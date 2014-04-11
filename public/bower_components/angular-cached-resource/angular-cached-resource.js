(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var LOCAL_STORAGE_PREFIX;

LOCAL_STORAGE_PREFIX = 'cachedResource://';

module.exports = window.localStorage != null ? {
  getItem: function(key, fallback) {
    var item;
    item = localStorage.getItem("" + LOCAL_STORAGE_PREFIX + key);
    if (item != null) {
      return angular.fromJson(item);
    } else {
      return fallback;
    }
  },
  setItem: function(key, value) {
    localStorage.setItem("" + LOCAL_STORAGE_PREFIX + key, angular.toJson(value));
    return value;
  }
} : {
  getItem: function(key, fallback) {
    return fallback;
  },
  setItem: function(key, value) {
    return value;
  }
};

},{}],2:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var CachedResourceManager, ResourceWriteQueue;

ResourceWriteQueue = require('./resource_write_queue');

CachedResourceManager = (function() {
  function CachedResourceManager($timeout) {
    this.$timeout = $timeout;
    this.queuesByKey = {};
  }

  CachedResourceManager.prototype.add = function(CachedResource) {
    return this.queuesByKey[CachedResource.$key] = new ResourceWriteQueue(CachedResource, this.$timeout);
  };

  CachedResourceManager.prototype.getQueue = function(CachedResource) {
    return this.queuesByKey[CachedResource.$key];
  };

  CachedResourceManager.prototype.flushQueues = function() {
    var key, queue, _ref, _results;
    _ref = this.queuesByKey;
    _results = [];
    for (key in _ref) {
      queue = _ref[key];
      _results.push(queue.flush());
    }
    return _results;
  };

  return CachedResourceManager;

})();

module.exports = CachedResourceManager;

},{"./resource_write_queue":6}],3:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var CachedResourceManager, DEFAULT_ACTIONS, ResourceCacheArrayEntry, ResourceCacheEntry, app, resourceManagerListener;

DEFAULT_ACTIONS = {
  get: {
    method: 'GET'
  },
  query: {
    method: 'GET',
    isArray: true
  },
  save: {
    method: 'POST'
  },
  remove: {
    method: 'DELETE'
  },
  "delete": {
    method: 'DELETE'
  }
};

ResourceCacheEntry = require('./resource_cache_entry');

ResourceCacheArrayEntry = require('./resource_cache_array_entry');

CachedResourceManager = require('./cached_resource_manager');

resourceManagerListener = null;

app = angular.module('ngCachedResource', ['ngResource']);

app.factory('$cachedResource', [
  '$resource', '$timeout', '$q', '$log', function($resource, $timeout, $q, $log) {
    var readArrayCache, readCache, resourceManager, writeCache;
    resourceManager = new CachedResourceManager($timeout);
    if (resourceManagerListener) {
      document.removeEventListener('online', resourceManagerListener);
    }
    resourceManagerListener = function(event) {
      return resourceManager.flushQueues();
    };
    document.addEventListener('online', resourceManagerListener);
    readArrayCache = function(name, CachedResource, boundParams) {
      return function(parameters) {
        var cacheArrayEntry, cacheInstanceEntry, cacheInstanceParams, deferred, resource, _i, _len, _ref;
        resource = CachedResource.$resource[name].apply(CachedResource.$resource, arguments);
        resource.$httpPromise = resource.$promise;
        if (angular.isFunction(parameters)) {
          parameters = {};
        }
        if (parameters == null) {
          parameters = {};
        }
        cacheArrayEntry = new ResourceCacheArrayEntry(CachedResource.$key, parameters);
        resource.$httpPromise.then(function(response) {
          return cacheArrayEntry.set(response.map(function(instance) {
            var attribute, cacheInstanceEntry, cacheInstanceParams, param;
            cacheInstanceParams = {};
            for (attribute in boundParams) {
              param = boundParams[attribute];
              if (typeof instance[attribute] !== "object" && typeof instance[attribute] !== "function") {
                cacheInstanceParams[param] = instance[attribute];
              }
            }
            if (Object.keys(cacheInstanceParams).length === 0) {
              $log.error("instance " + instance + " doesn't have any boundParams. Please, make sure you specified them in your resource's initialization, f.e. `{id: \"@id\"}`, or it won't be cached.");
            } else {
              cacheInstanceEntry = new ResourceCacheEntry(CachedResource.$key, cacheInstanceParams);
              cacheInstanceEntry.set(instance, false);
            }
            return cacheInstanceParams;
          }));
        });
        if (cacheArrayEntry.value) {
          _ref = cacheArrayEntry.value;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            cacheInstanceParams = _ref[_i];
            cacheInstanceEntry = new ResourceCacheEntry(CachedResource.$key, cacheInstanceParams);
            resource.push(new CachedResource(cacheInstanceEntry.value));
          }
          deferred = $q.defer();
          resource.$promise = deferred.promise;
          deferred.resolve(resource);
        }
        return resource;
      };
    };
    readCache = function(name, CachedResource) {
      return function() {
        var args, cacheDeferred, cacheEntry, error, httpDeferred, instance, params, readHttp, success;
        args = Array.prototype.slice.call(arguments);
        params = angular.isObject(args[0]) ? args.shift() : {};
        success = args[0], error = args[1];
        cacheDeferred = $q.defer();
        if (angular.isFunction(success)) {
          cacheDeferred.promise.then(success);
        }
        if (angular.isFunction(error)) {
          cacheDeferred.promise["catch"](error);
        }
        httpDeferred = $q.defer();
        instance = new CachedResource({
          $promise: cacheDeferred.promise,
          $httpPromise: httpDeferred.promise
        });
        cacheEntry = new ResourceCacheEntry(CachedResource.$key, params);
        readHttp = function() {
          var resource;
          resource = CachedResource.$resource[name].call(CachedResource.$resource, params);
          resource.$promise.then(function(response) {
            angular.extend(instance, response);
            if (!cacheEntry.value) {
              cacheDeferred.resolve(instance);
            }
            httpDeferred.resolve(instance);
            return cacheEntry.set(response, false);
          });
          return resource.$promise["catch"](function(error) {
            if (!cacheEntry.value) {
              cacheDeferred.reject(error);
            }
            return httpDeferred.reject(error);
          });
        };
        if (cacheEntry.dirty) {
          resourceManager.getQueue(CachedResource).processResource(params, readHttp);
        } else {
          readHttp();
        }
        if (cacheEntry.value) {
          angular.extend(instance, cacheEntry.value);
          cacheDeferred.resolve(instance);
        }
        return instance;
      };
    };
    writeCache = function(action, CachedResource) {
      return function() {
        var args, cacheEntry, deferred, error, instanceMethod, params, postData, queue, queueDeferred, resource, success;
        instanceMethod = this instanceof CachedResource;
        args = Array.prototype.slice.call(arguments);
        params = !instanceMethod && angular.isObject(args[1]) ? args.shift() : instanceMethod && angular.isObject(args[0]) ? args.shift() : {};
        postData = instanceMethod ? this : args.shift();
        success = args[0], error = args[1];
        resource = this || new CachedResource();
        resource.$resolved = false;
        deferred = $q.defer();
        resource.$promise = deferred.promise;
        if (angular.isFunction(success)) {
          deferred.promise.then(success);
        }
        if (angular.isFunction(error)) {
          deferred.promise["catch"](error);
        }
        cacheEntry = new ResourceCacheEntry(CachedResource.$key, params);
        if (!angular.equals(cacheEntry.data, postData)) {
          cacheEntry.set(postData, true);
        }
        queueDeferred = $q.defer();
        queueDeferred.promise.then(function(value) {
          angular.extend(resource, value);
          resource.$resolved = true;
          return deferred.resolve(resource);
        });
        queueDeferred.promise["catch"](deferred.reject);
        queue = resourceManager.getQueue(CachedResource);
        queue.enqueue(params, action, queueDeferred);
        queue.flush();
        return resource;
      };
    };
    return function() {
      var $key, CachedResource, Resource, actions, arg, args, boundParams, handler, name, param, paramDefault, paramDefaults, params, url, _ref;
      args = Array.prototype.slice.call(arguments);
      $key = args.shift();
      url = args.shift();
      while (args.length) {
        arg = args.pop();
        if (angular.isObject(arg[Object.keys(arg)[0]])) {
          actions = arg;
        } else {
          paramDefaults = arg;
        }
      }
      actions = angular.extend({}, DEFAULT_ACTIONS, actions);
      if (paramDefaults == null) {
        paramDefaults = {};
      }
      boundParams = {};
      for (param in paramDefaults) {
        paramDefault = paramDefaults[param];
        if (paramDefault[0] === '@') {
          boundParams[paramDefault.substr(1)] = param;
        }
      }
      Resource = $resource.call(null, url, paramDefaults, actions);
      CachedResource = (function() {
        function CachedResource(attrs) {
          angular.extend(this, attrs);
        }

        CachedResource.$resource = Resource;

        CachedResource.$key = $key;

        return CachedResource;

      })();
      for (name in actions) {
        params = actions[name];
        handler = params.method === 'GET' && params.isArray ? readArrayCache(name, CachedResource, boundParams) : params.method === 'GET' ? readCache(name, CachedResource) : (_ref = params.method) === 'POST' || _ref === 'PUT' || _ref === 'DELETE' ? writeCache(name, CachedResource) : void 0;
        CachedResource[name] = handler;
        if (params.method !== 'GET') {
          CachedResource.prototype["$" + name] = handler;
        }
      }
      resourceManager.add(CachedResource);
      resourceManager.flushQueues();
      return CachedResource;
    };
  }
]);

if (typeof module !== "undefined" && module !== null) {
  module.exports = app;
}

},{"./cached_resource_manager":2,"./resource_cache_array_entry":4,"./resource_cache_entry":5}],4:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var ResourceCacheArrayEntry, ResourceCacheEntry,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

ResourceCacheEntry = require('./resource_cache_entry');

ResourceCacheArrayEntry = (function(_super) {
  __extends(ResourceCacheArrayEntry, _super);

  function ResourceCacheArrayEntry() {
    return ResourceCacheArrayEntry.__super__.constructor.apply(this, arguments);
  }

  ResourceCacheArrayEntry.prototype.defaultValue = [];

  ResourceCacheArrayEntry.prototype.setKey = function(key) {
    return this.key = "" + key + "/array";
  };

  return ResourceCacheArrayEntry;

})(ResourceCacheEntry);

module.exports = ResourceCacheArrayEntry;

},{"./resource_cache_entry":5}],5:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var Cache, ResourceCacheEntry;

Cache = require('./cache');

ResourceCacheEntry = (function() {
  ResourceCacheEntry.prototype.defaultValue = {};

  function ResourceCacheEntry(resourceKey, params) {
    var param, paramKeys, _ref;
    this.setKey(resourceKey);
    paramKeys = angular.isObject(params) ? Object.keys(params).sort() : [];
    if (paramKeys.length) {
      this.key += '?' + ((function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = paramKeys.length; _i < _len; _i++) {
          param = paramKeys[_i];
          _results.push("" + param + "=" + params[param]);
        }
        return _results;
      })()).join('&');
    }
    _ref = Cache.getItem(this.key, this.defaultValue), this.value = _ref.value, this.dirty = _ref.dirty;
  }

  ResourceCacheEntry.prototype.setKey = function(key) {
    this.key = key;
  };

  ResourceCacheEntry.prototype.set = function(value, dirty) {
    this.value = value;
    this.dirty = dirty;
    return this._update();
  };

  ResourceCacheEntry.prototype.setClean = function() {
    this.dirty = false;
    return this._update();
  };

  ResourceCacheEntry.prototype._update = function() {
    return Cache.setItem(this.key, {
      value: this.value,
      dirty: this.dirty
    });
  };

  return ResourceCacheEntry;

})();

module.exports = ResourceCacheEntry;

},{"./cache":1}],6:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var CACHE_RETRY_TIMEOUT, Cache, ResourceCacheEntry, ResourceWriteQueue;

CACHE_RETRY_TIMEOUT = 60000;

ResourceCacheEntry = require('./resource_cache_entry');

Cache = require('./cache');

ResourceWriteQueue = (function() {
  function ResourceWriteQueue(CachedResource, $timeout) {
    this.CachedResource = CachedResource;
    this.$timeout = $timeout;
    this.key = "" + this.CachedResource.$key + "/write";
    this.queue = Cache.getItem(this.key, []);
  }

  ResourceWriteQueue.prototype.enqueue = function(params, action, deferred) {
    var entry, _ref, _ref1;
    entry = this.findEntry({
      params: params,
      action: action
    });
    if (entry == null) {
      this.queue.push({
        params: params,
        action: action,
        deferred: deferred
      });
      return this._update();
    } else {
      if ((_ref = entry.deferred) != null) {
        _ref.promise.then(function(response) {
          return deferred.resolve(response);
        });
      }
      return (_ref1 = entry.deferred) != null ? _ref1.promise["catch"](function(error) {
        return deferred.reject(error);
      }) : void 0;
    }
  };

  ResourceWriteQueue.prototype.findEntry = function(_arg) {
    var action, entry, params, _i, _len, _ref;
    action = _arg.action, params = _arg.params;
    _ref = this.queue;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      entry = _ref[_i];
      if (action === entry.action && angular.equals(params, entry.params)) {
        return entry;
      }
    }
  };

  ResourceWriteQueue.prototype.removeEntry = function(_arg) {
    var action, entry, newQueue, params, _i, _len, _ref;
    action = _arg.action, params = _arg.params;
    newQueue = [];
    _ref = this.queue;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      entry = _ref[_i];
      if (!(action === entry.action && angular.equals(params, entry.params))) {
        newQueue.push(entry);
      }
    }
    this.queue = newQueue;
    if (this.queue.length === 0 && this.timeoutPromise) {
      this.$timeout.cancel(this.timeoutPromise);
      delete this.timeoutPromise;
    }
    return this._update();
  };

  ResourceWriteQueue.prototype.flush = function() {
    var entry, _i, _len, _ref, _results;
    this._setFlushTimeout();
    _ref = this.queue;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      entry = _ref[_i];
      _results.push(this._processEntry(entry));
    }
    return _results;
  };

  ResourceWriteQueue.prototype.processResource = function(params, done) {
    var entry, notDone, _i, _len, _ref, _results;
    notDone = true;
    _ref = this._entriesForResource(params);
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      entry = _ref[_i];
      _results.push(this._processEntry(entry, (function(_this) {
        return function() {
          if (notDone && _this._entriesForResource(params).length === 0) {
            notDone = false;
            return done();
          }
        };
      })(this)));
    }
    return _results;
  };

  ResourceWriteQueue.prototype._entriesForResource = function(params) {
    var entry, _i, _len, _ref, _results;
    _ref = this.queue;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      entry = _ref[_i];
      if (angular.equals(params, entry.params)) {
        _results.push(entry);
      }
    }
    return _results;
  };

  ResourceWriteQueue.prototype._processEntry = function(entry, done) {
    var cacheEntry, onFailure, onSuccess;
    cacheEntry = new ResourceCacheEntry(this.CachedResource.$key, entry.params);
    onSuccess = (function(_this) {
      return function(value) {
        var _ref;
        _this.removeEntry(entry);
        cacheEntry.setClean();
        if ((_ref = entry.deferred) != null) {
          _ref.resolve(value);
        }
        if (angular.isFunction(done)) {
          return done();
        }
      };
    })(this);
    onFailure = (function(_this) {
      return function(error) {
        var _ref;
        return (_ref = entry.deferred) != null ? _ref.reject(error) : void 0;
      };
    })(this);
    return this.CachedResource.$resource[entry.action](entry.params, cacheEntry.value, onSuccess, onFailure);
  };

  ResourceWriteQueue.prototype._setFlushTimeout = function() {
    if (this.queue.length > 0 && !this.timeoutPromise) {
      this.timeoutPromise = this.$timeout(angular.bind(this, this.flush), CACHE_RETRY_TIMEOUT);
      return this.timeoutPromise.then((function(_this) {
        return function() {
          delete _this.timeoutPromise;
          return _this._setFlushTimeout();
        };
      })(this));
    }
  };

  ResourceWriteQueue.prototype._update = function() {
    var savableQueue;
    savableQueue = this.queue.map(function(entry) {
      return {
        params: entry.params,
        action: entry.action
      };
    });
    return Cache.setItem(this.key, savableQueue);
  };

  return ResourceWriteQueue;

})();

module.exports = ResourceWriteQueue;

},{"./cache":1,"./resource_cache_entry":5}]},{},[3])