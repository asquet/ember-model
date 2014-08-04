

Ember.DeletableHasManyArray = Ember.HasManyArray.extend({

  _applyListeners : function(ref) {
	if (Em.typeOf(ref) == 'instance') ref = ref._reference;
	
	if (!ref.record) ref.record = this._materializeRecord(ref);
	
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
    return content.findProperty('record', record);
  },
  
  save : function(func) {
	return Em.RSVP.all(this.get('content').map(function(item) {
		if (func && !item.record.get('isDeleted')) {
			return item.record.save().then(function() {
				return Em.loadPromise(func(item.record));
			});
		} else {
			return item.record.save();
		}
	}));
  },
  
  saveSequential : function(func) {
	var promise = new Em.RSVP.Promise(function(r){r();});
	var content = this.get('content');
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
	}, promise);
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

  _materializeRecord : function(reference) {
      var klass = Ember.get(this, 'modelClass');
      var record;
      if (reference.record) {
          record = reference.record;
      } else {
          record = klass.find(reference.id);
          reference.record = record;
      }

      return record;
  },

  materializeRecord : function(idx) {
    var content = Ember.get(this, 'arrangedContent'),
        reference = content.objectAt(idx);

    return this._materializeRecord(reference);
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