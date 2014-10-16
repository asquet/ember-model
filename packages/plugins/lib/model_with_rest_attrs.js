var emberize = function(object) {
    for (var i in object) {
        if (object.hasOwnProperty(i)) {
            if (Ember.typeOf(object[i]) == 'object') {
                object[i] = emberize(object[i]);
            }
        }
    }
    return Em.Object.create(object);
};
	
Ember.Model.reopenClass({
	
	makeLoadableProp : function(propName, restFunc, transformFunc) {
		var fakePropname = '_'+propName;
		
		var f = function(key, value) {
			if (arguments.length == 2) {
				this.set(fakePropname, value);
				return value;
			} else {
				if (typeof this.get(Em.get(this.constructor,'primaryKey')) === "undefined") {
					return undefined;
				}
								
				if (typeof(this.get(fakePropname))=='undefined') {
					var that = this;
					this.callRestOnObject(restFunc).then(function(res) {
						if (transformFunc) {
							res = transformFunc(res);
						} else if (res && typeof res == 'object') {
							res = emberize(res);
						}
						that.set(fakePropname, res);
						that.notifyPropertyChange(propName);
					});
				}
				return this.get(fakePropname);
			}
		}.property();
		
		return f;
	},
	
	makeLoadableArrayProp : function(propName, restFunc, transformFunc) {
		var fakePropname = '_'+propName;
		return function(key, value) {
			if (arguments.length == 1 || arguments[1] == ({}[1])) {
				if (typeof(this.get(fakePropname))=='undefined' || (arguments.length == 2 && arguments[1] == ({}[1])) ) {
					this.set(fakePropname, []);
					var that = this;
					this.callRestOnObject(restFunc).then(function(data) {
						var d = [];
						if (transformFunc) {
							data.forEach(function(item, i){
								d.push(transformFunc(i, item));
							});
						} else {
							d = data;
						}

						that.get(fakePropname).addObjects(d.sort(function(a, b) {
                            return a.id - b.id;
                        }));
					});
				}
				return this.get(fakePropname);
			} else {
				this.set(fakePropname, value);
				return value;
			}
			
		}.property(fakePropname+'.@each');
	},
});
Ember.Model.reopen({
	reloadProp : function(propName) {
		this.set(propName, undefined);
		var that = this;
		var p = new Em.RSVP.Promise(function(resolve, reject){
			var t = setTimeout(reject, 1000);
			that.one(propName, function() {
				clearTimeout(t);
				resolve(that.get(propName));
			});
		});
		
		that.notifyPropertyChange(propName);
		return p;
	}

});
