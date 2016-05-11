(function() {

var emberize = function (object) {
    for (var i in object) {
        if (object.hasOwnProperty(i)) {
            if (Ember.typeOf(object[i]) == 'object') {
                object[i] = emberize(object[i]);
            }
        }
    }
    return Em.Object.create(object);
};

Ember.Model.reopen({
    _requestedLoadableProps: function () {
        return [];
    }.property().readOnly()
});

Ember.Model.reopenClass({

    makeLoadableProp: function (propName, restFunc, transformFunc) {
        var fakePropName = '_' + propName;
        return Ember.computed(fakePropName, function (key, value) {
            if (arguments.length >= 2) {
                this.set(fakePropName, value);
                return value;
            }

            if (typeof this.get(Em.get(this.constructor, 'primaryKey')) === "undefined") {
                return undefined;
            }

            if (!this.get("_requestedLoadableProps").contains(propName)) {
                var that = this;

                this.get("_requestedLoadableProps").addObject(propName);
                this.callRestOnObject(restFunc).then(function (res) {
                    if (transformFunc) {
                        res = transformFunc(res);
                    } else if (res && typeof res == 'object') {
                        res = emberize(res);
                    }
                    that.set(fakePropName, res);
                    //that.notifyPropertyChange(propName);
                });
            }

            return this.get(fakePropName);

        });
    },

    makeLoadableArrayProp: function (propName, restFunc, transformFunc) {
        var fakePropName = '_' + propName;
        return Ember.computed(fakePropName + '.[]', function (key, value) {
            if (arguments.length >= 2) {
                this.set(fakePropName, value);
                return value;
            }

            if (!this.get("_requestedLoadableProps").contains(propName)) {
                this.get("_requestedLoadableProps").addObject(propName);

                this.set(fakePropName, []);
                var that = this;
                this.callRestOnObject(restFunc).then(function (data) {
                    var d = [];
                    if (transformFunc) {
                        data.forEach(function (item, i) {
                            d.push(transformFunc(i, item));
                        });
                    } else {
                        d = data;
                    }

                    that.get(fakePropName).addObjects(d.sort(function (a, b) {
                        return a.id - b.id;
                    }));
                });
            }
            return this.get(fakePropName);
        });
    }
});

Ember.Model.reopen({
    reloadProp: function (propName) {
        this.get("_requestedLoadableProps").removeObject(propName);
        var that = this;
        var p = new Em.RSVP.Promise(function (resolve, reject) {
            var t = setTimeout(reject, 500);
            var f = function () {
                clearTimeout(t);
                that.removeObserver(propName, that, f);
                resolve(that.get(propName));
            };
            that.addObserver(propName, that, f);
        });

        that.notifyPropertyChange(propName);
        return p;
    }
});


})();

(function() {



})();

(function() {



Ember.DeletableHasManyArray = Ember.HasManyArray.extend({

  _applyListeners : function(ref) {
	if (Em.typeOf(ref) == 'instance') ref = ref._reference;
	
	if (!ref.record) ref.record = this._materializeRecord(ref, this.container);
	
	ref.record.get('isDirty');ref.record.get('isDeleted');//initListeners
	
	Ember.addObserver(ref, 'record.isDirty', this, 'recordStateChanged');
	Ember.addObserver(ref, 'record.isDeleted', this, 'recordStateChanged');
	Ember.addObserver(ref.record, 'isDeleted', this, 'contentItemFilterPropertyDidChange');
	
	var isDirtyRecord = ref.record.get('isDirty'), isNewRecord = ref.record.get('isNew');
	if (isDirtyRecord || isNewRecord) { this._modifiedRecords.pushObject(ref); }
	return ref;
	
  },
  _stripListeners : function(ref) {
    if (Em.typeOf(ref) == 'instance') ref = ref._reference;

	Ember.removeObserver(ref, 'record.isDirty', this, 'recordStateChanged');
	Ember.removeObserver(ref, 'record.isDeleted', this, 'recordStateChanged');	  
	Ember.removeObserver(ref.record, 'isDeleted', this, 'contentItemFilterPropertyDidChange');
  },
  //--  arrangedContent controlling
  
  arrangedContent : function() {
    var content = this.get('content');
    var arrCnt= [];
    var that =  this;
    if (!content)return arrCnt;
	var that = this;
	content.forEach(function(item) {
	  that._applyListeners(item);

      if (!item.record.get('isDeleted')) {
        arrCnt.push(item);
      }
    });
    
    return arrCnt;
  }.property('content.@each.isDeleted'),

  contentItemFilterPropertyDidChange : function (item){
    item = this.getReferenceByRecord(item);
    this.addOrRemoveItem (item);
  },
  
  addOrRemoveItem : function(item) {
    if (!item.record.get('isDeleted')) {
      this.get('arrangedContent').pushObject(item);
    } else {
      this.get('arrangedContent').removeObject(item);
    }
	this.arrayDidChange(this.get('arrangedContent'), 0, 0, this.get('arrangedContent.length'));
  },

  contentArrayDidChange : function(array, idx, removedCount, addedCount) {
    var addedObjects = array.slice(idx, idx + addedCount);
    var that = this;
    addedObjects.forEach(function(item) {
      that.addOrRemoveItem(item);
      that._applyListeners(item);
    });
    this._super(array, idx, removedCount, addedCount);	
	
	this.arrayDidChange(this.get('arrangedContent'), 0, 0, this.get('arrangedContent.length'));
  },

  contentArrayWillChange : function (array, idx, removedCount, addedCount) {
	var removedObjects = array.slice(idx, idx+removedCount);
	var that = this;
    removedObjects.forEach ( function(item) {
      that.get('arrangedContent').removeObject(item);
      that._stripListeners(item);
    });
    this._super(array, idx, removedCount, addedCount);
  },
  
  addObject : function(obj) {
    obj = this._applyListeners(obj);
	
    this.get('content').addObject(obj);
  },
  pushObject : function(obj) {
	obj = this._applyListeners(obj);
	
    this.get('content').pushObject(obj);
  },
  
  removeObject : function(obj) {
	this._stripListeners(obj);

    this.get('content').removeObject(obj);
  },
  
  //--- support
  
  getReferenceByRecord : function(record) {
    var content = this.get('content');
    return content.findBy('record', record);
  },
  
  save : function(func) {
    var that = this;
	return Em.RSVP.all(this.get('content').map(function(item) {
		if (func && !item.record.get('isDeleted')) {
			return item.record.save().then(function() {
				return Em.loadPromise(func(item.record));
			});
		} else {
			return item.record.save();
		}
	})).then(function() {
        var parent = Em.get(that, 'parent'), relationshipKey = Em.get(that, 'relationshipKey');
        that._setupOriginalContent(that.get('content'));
		that.set('isLoaded', true);
        parent._relationshipBecameClean(relationshipKey);
    });
  },
  
  saveSequential : function(func) {
	var promise = new Em.RSVP.Promise(function(r){r();});
	var content = this.get('content');
    var that = this;
	return content.reduce(function(promise, item) {
			return promise.then(function(){
				if (func && !item.record.get('isDeleted')) {
					return item.record.save().then(function() {
						return Em.loadPromise(func(item.record));
					});
				} else {
					return item.record.save();
				}
			});
	}, promise).then(function() {
        var parent = Em.get(that, 'parent'), relationshipKey = Em.get(that, 'relationshipKey');
        that._setupOriginalContent(that.get('content'));
        parent._relationshipBecameClean(relationshipKey);
    });
  },
  
  //--- reloaded ember-model methods
  
  objectAtContent : function(idx) {
    var content = Ember.get(this, 'arrangedContent');

    if (!content.length) {
      return;
    }

	// need to add observer if it wasn't materialized before
    var observerNeeded = (content[idx].record) ? false : true;

    var record = this.materializeRecord(idx, this.container);
    
    if (observerNeeded) {
	  this._applyListeners(content[idx]);
      record.registerParentHasManyArray(this);
    }

    return record;
  },

  _materializeRecord : function(reference,container) {
      var klass = Ember.get(this, 'modelClass');
      var record;
      if (reference.record) {
          record = reference.record;
      } else {
          record = klass.find(reference.id);
          reference.record = record;
      }
	  if (record) record.container = container;
      return record;
  },

  materializeRecord : function(idx, container) {
    var content = Ember.get(this, 'arrangedContent'),
        reference = content.objectAt(idx);

    return this._materializeRecord(reference, container);
  },
  
  reload : function() {
    throw new Error('not implemented for DeletableHasManyArray');
  },
  
  /* dirtying */
  
  loadData : function(klass,data) {
	  for (var i=this.get('content.length'); i--;){
		  this.removeObject(this.get('content')[i]);
      }
      klass.load(data);
      var d=[];
      for (var i=0; i<data.length; i++){
          var item = data[i];
		  var ref = item._reference || klass._getOrCreateReferenceForId(Em.get(item, 'id'))
		  this._applyListeners(ref);
		  
          d.push(ref);
      }

      this._setupOriginalContent(d);
      this.load(d);
  },
  
  arrayWillChange: function(item, idx, removedCnt, addedCnt) {
   
  },
  
  arrayDidChange: function(item, idx, removedCnt, addedCnt) {
    var parent = Em.get(this, 'parent'), relationshipKey = Em.get(this, 'relationshipKey'),
        isDirty = Em.get(this, 'isDirty');

    var content = item;
    for (var i = idx; i < idx+addedCnt; i++) {
      var currentItem = content[i];
      if (currentItem && currentItem.record) { 
        var isDirtyRecord = currentItem.record.get('isDirty'), isNewRecord = currentItem.record.get('isNew'); // why newly created object is not dirty?
        if (isDirtyRecord || isNewRecord) { this._modifiedRecords.pushObject(currentItem); }
        this._applyListeners(currentItem);
        currentItem.record.registerParentHasManyArray(this);
      }
    }

    if (isDirty) {
      parent._relationshipBecameDirty(relationshipKey);
    } else {
      parent._relationshipBecameClean(relationshipKey);
    }
  },
  
  recordStateChanged: function(obj, keyName) {
    var parent = Em.get(this, 'parent'), relationshipKey = Em.get(this, 'relationshipKey');    

	if (obj.record.get('isDeleted')) {
		if (Em.get(this, 'originalContent').indexOf(obj)>-1) {
			if (this._modifiedRecords.indexOf(obj) === -1) { this._modifiedRecords.pushObject(obj); } 
			parent._relationshipBecameDirty(relationshipKey);
		} else {
			if (this._modifiedRecords.indexOf(obj) > -1) { this._modifiedRecords.removeObject(obj); }
			if (!this.get('isDirty')) {
			  parent._relationshipBecameClean(relationshipKey); 
			}
		}
	} else if (obj.record.get('isDirty')) {
      if (this._modifiedRecords.indexOf(obj) === -1) { this._modifiedRecords.pushObject(obj); }
      parent._relationshipBecameDirty(relationshipKey);
    } else {
      if (this._modifiedRecords.indexOf(obj) > -1) { this._modifiedRecords.removeObject(obj); }
      if (!this.get('isDirty')) {
        parent._relationshipBecameClean(relationshipKey); 
      }
    }
  },
  
  isDirty: function() {
    var originalContent = Em.get(this, 'originalContent'),
        originalContentLength = Em.get(originalContent, 'length'),
        content = Em.get(this, 'content').rejectBy('record.isDeleted'),
        contentLength = Em.get(content, 'length');

	if (!originalContent) return false;
		
    if (originalContentLength !== contentLength) { return true; }

	if (this._modifiedRecords && this._modifiedRecords.length) { return true; }
	
    var isDirty = false;

    for (var i = 0, l = contentLength; i < l; i++) {
      if (!originalContent.contains(content[i])) {
        isDirty = true;
        break;
      }
    }

    return isDirty;
  }.property('content.[]', 'originalContent.[]', '_modifiedRecords.[]')
  
  

  
});

Ember.Model
    .reopen({
      getHasMany : function(key, type, meta, container) {
		var embedded = meta.options.embedded,
			collectionClass;
        if (Em.get(this, 'isRequested')) {
			collectionClass = embedded ? Ember.EmbeddedHasManyArray : Ember.DeletableHasManyArray;

			var collection = collectionClass.create({
			  parent : this,
			  modelClass : type,
			  content : null,
			  embedded : embedded,
			  key : key,
			  relationshipKey: meta.relationshipKey,
			  container : container
			});
			
			collection.set('content', this._getHasManyContent(key, type, embedded, collection));
			collection.set('_modifiedRecords', []);
		} else {
			collectionClass = embedded ? Ember.EmbeddedHasManyArray : Ember.HasManyArray;

			var collection = collectionClass.create({
			  parent: this,
			  modelClass: type,
			  content: this._getHasManyContent(key, type, embedded),
			  embedded: embedded,
			  key: key,
			  relationshipKey: meta.relationshipKey,
			  container: container
			});
		}

        this._registerHasManyArray(collection);

        return collection;
      },

      save : function() {
        var adapter = this.constructor.adapter;
        Ember.set(this, 'isSaving', true);
        if (Ember.get(this, 'isDeleted')) {
			if (Ember.get(this,'isNew')) {
				this.constructor.unload(this)
			} else {
				return this.deleteRecord(this);
			}
        } else if (Ember.get(this, 'isNew')) {
          return adapter.createRecord(this);
        } else if (Ember.get(this, 'isDirty')) {
          return adapter.saveRecord(this);
        } else { // noop, return a resolved promise
          var self = this, promise = new Ember.RSVP.Promise(function(
              resolve, reject) {
            resolve(self);
          });
          Ember.set(this, 'isSaving', false);
          return promise;
        }
      },

	  revert: function() {
		this.getWithDefault('_dirtyAttributes', []).clear();
		this.notifyPropertyChange('_data');
		if (Em.get(this, 'isRequested')) {
			this.set('isDeleted', false);
			this._revertUnpersistentHasManys();
		} else {
			this._reloadHasManys(true);
		}
	  },
	  _revertUnpersistentHasManys : function() {
		if (!this._hasManyArrays) { return; }
		var i, j;
		for (i = 0; i < this._hasManyArrays.length; i++) {
		  var array = this._hasManyArrays[i];
			for (j=0; j<array.content.length;j++) {
				array.content[j].record.revert();
			}
		}
	  }

    });
	
	Ember.Model.reopenClass({
	 reload: function(id, container) {
	    var record = this.cachedRecordForId(id, container);
		record.set('isLoaded', false);
		if (Em.get(this, 'isRequested')) {
			return this._fetchById(record, id).then(function() {
				if (record._hasManyArrays) {
					record._hasManyArrays.forEach(function(item){item.set('content',null);});//clear hasManys, so that they would reload
					record._reloadHasManys();
				}
			});
		} else {
			return this._fetchById(record, id);
		}
	  }
	});


})();

(function() {



})();

(function() {



var get = Ember.get, set = Ember.set;

Ember.RESTAdapterExt = Ember.RESTAdapter
    .extend({
      namespace : "rest",

      findMany : function(klass, records, ids) {
        var urlRoot = this.namespace + "/" + klass.getDefaultRestUrl();
        return this.ajax(urlRoot, {
            ids : ids
          }
        ).then(function(response) {
          records.load(klass, response);
        });
      },

      buildURL : function(klass, id) {
        var urlRoot = get(klass, 'url');
        if (!urlRoot) {
          urlRoot = klass.getDefaultRestUrl();
        }
        urlRoot = this.namespace + "/" + urlRoot;
        if (Em.typeOf(id)!='undefined' && Em.typeOf(id)!='null' ) {
          return urlRoot + "/" + id;
        } else {
          return urlRoot;
        }
      },

      loadHasMany : function(record, propName, type, collection) {
        var content = [];
        var url = this.namespace + "/" + 
            record.constructor.getDefaultRestUrl() + "/" + 
            record.get('id') + "/" + propName;

        this.ajax(url).then(function(response) {			
			Ember.run(collection, collection.loadData, type, response);
			collection.notifyLoaded();
        });

        return content;
      },
      
      deleteRecord : function(record) {
        var primaryKey = get(record.constructor, 'primaryKey'), 
          url = this.buildURL(record.constructor, get(record,primaryKey)), 
          self = this;
        
        if (get(record,  primaryKey)) {
          return this.ajax(url, record.toJSON(), "DELETE").then(
              function(data) { // TODO: Some APIs may or may
                        // not return data
                self.didDeleteRecord(record, data);
              });
        } else {
          self.didDeleteRecord(record, null);
        }
      },
      
      callRestOnObject : function(record, action, method, data, settings) {
        var primaryKey = get(record.constructor, 'primaryKey');
        var url = this.buildURL(record.constructor, get(record, primaryKey)) + "/" + action;
        return this.ajax(url, data, method, settings);
      },
      
      callRestOnClass : function(klazz, action, method, data, settings) {
        var url = this.buildURL(klazz) + "/" + action;
        return this.ajax(url, data, method, settings);
      }

    });

Ember.Model.reopenClass({
  //adapter : Ember.RESTAdapterExt.create(),
  //isRequested : true,
  getDefaultRestUrl : function() {
    return this['url'] || this.toString().substring(this.toString().indexOf(':') + 1, this.toString().lastIndexOf(':'))
        .underscore() + 's';
  }
});
  
Ember.Model.reopen({
  callRestOnObject : function(action, method, data, settings) {
    return this.constructor.adapter.callRestOnObject(this, action, method, data, settings);
  }
});
Ember.Model.reopenClass({
  
  callRestOnClass : function(action, method, data, settings) {
    return this.adapter.callRestOnClass(this, action, method, data, settings);
  }

});


})();