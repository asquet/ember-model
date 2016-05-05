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
