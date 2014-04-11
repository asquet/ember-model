

Ember.DeletableHasManyArray = Ember.HasManyArray.extend({

  //--  arrangedContent controlling
  
  arrangedContent : function() {
    var content = this.get('content');
    var arrCnt= [];
    var that =  this;
    if (!content)return arrCnt;
	var that = this;
	content.forEach(function(item) {
      //item = that._materializeRecord(item);
	  if (!item.record) {
		item.record = that._materializeRecord(item)
	  }
      item.record.addObserver('isDeleted', that, 'contentItemFilterPropertyDidChange');
      
      if (!item.record.get('isDeleted')) {
        arrCnt.push(item);
      }
    });
    
    return arrCnt;
  }.property('content'),

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
      item.record.addObserver('isDeleted', that, 'contentItemFilterPropertyDidChange');
    });
    this._super(array, idx, removedCount, addedCount);	
	
	//this.arrayDidChange(this.get('arrangedContent'), 0, 0, this.get('arrangedContent.length'));
  },

  contentArrayWillChange : function (array, idx, removedCount, addedCount) {
	var removedObjects = array.slice(idx, idx+removedCount);
	var that = this;
    removedObjects.forEach ( function(item) {
      that.get('arrangedContent').removeObject(item);
      item.record.removeObserver('isDeleted', that, 'contentItemFilterPropertyDidChange');
    });
    this._super(array, idx, removedCount, addedCount);
	
  },
  
  addObject : function(obj) {
    if (!obj.record) {obj = obj._reference || obj._getOrCreateReferenceForId(obj.get('id'))}//TODO change id to "get primary key"
    this.get('content').addObject(obj);
  },
  pushObject : function(obj) {
    if (!obj.record) {obj = obj._reference || obj._getOrCreateReferenceForId(obj.get('id'))}//TODO change id to "get primary key"
    this.get('content').pushObject(obj);
  },
  
  removeObject : function(obj) {
	if (!obj.record) {obj = obj._reference || obj._getOrCreateReferenceForId(obj.get('id'))}//TODO change id to "get primary key"
    this.get('content').removeObject(obj);
  },
  
  //--- support
  
  getReferenceByRecord : function(record) {
    var content = this.get('content');
    return content.findProperty('record', record);
  },
  
  //--- reloaded ember-model methods
  
  objectAtContent : function(idx) {
    var content = Ember.get(this, 'arrangedContent');

    if (!content.length) {
      return;
    }

    return this.materializeRecord(idx);
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
  
  /* dirtying */
  
  loadData : function(klass,data) {
	//this.set('content', data);
	this.load(data);
	this._setupOriginalContent(this.get('arrangedContent'));
  },
  
  isDirty: function() {
    var originalContent = Em.get(this, 'originalContent'),
        originalContentLength = Em.get(originalContent, 'length'),
        content = Em.get(this, 'arrangedContent'),
        contentLength = Em.get(content, 'length');

	if (!originalContent) return false;
		
    if (originalContentLength !== contentLength) { return true; }

    var isDirty = false;

    for (var i = 0, l = contentLength; i < l; i++) {
      if (!originalContent.contains(content[i])) {
        isDirty = true;
        break;
      }
    }

    return isDirty;
  }.property('arrangedContent.[]', 'originalContent'),
  
 

  
});

Ember.Model
    .reopen({
      getHasMany : function(key, type, meta) {
        var embedded = meta.options.embedded, collectionClass = embedded ? Ember.EmbeddedHasManyArray
            : Ember.DeletableHasManyArray;

        var collection = collectionClass.create({
          parent : this,
          modelClass : type,
          content : null,
          embedded : embedded,
          key : key,
		  relationshipKey: meta.relationshipKey
        });

		collection.set('content', this._getHasManyContent(key, type, embedded, collection));
		
        this._registerHasManyArray(collection);

        return collection;
      },

      save : function() {
        var adapter = this.constructor.adapter;
        Ember.set(this, 'isSaving', true);
        if (Ember.get(this, 'isDeleted')) {
          return this.deleteRecord(this);
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
      }

    });