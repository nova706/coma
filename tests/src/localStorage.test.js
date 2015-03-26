/*globals describe, sinon, beforeEach, module, inject, it, should*/
describe("LocalStorage", function () {
    var recallLocalStorage;
    var $window;
    var $document;
    var fakeLocalStorage;
    var fakeCookie;
    var life;

    beforeEach(module('recall', function ($provide) {
        fakeLocalStorage = {
            setItem: function (key, value) {},
            getItem: function (key) {},
            removeItem: function (key) {}
        };
        fakeCookie = "";
        $provide.value('$window', {
            localStorage: fakeLocalStorage
        });
        $provide.value('$document', {
            cookie: fakeCookie
        });
    }));

    beforeEach(inject(function (_$document_, _$window_, _recallLocalStorage_) {
        $window = _$window_;
        $document = _$document_;
        life = 60 * 60 * 24 * 5;
        recallLocalStorage = _recallLocalStorage_;
    }));

    describe("set", function () {
        beforeEach(inject(function () {
            sinon.stub(fakeLocalStorage, 'getItem').returns("test");
            sinon.stub(fakeLocalStorage, 'setItem');
            sinon.stub(fakeLocalStorage, 'removeItem');
        }));

        it("Should not do anything if the key does not exist", function () {
            recallLocalStorage.set('test', '1');
            $window.localStorage.setItem.called.should.equal(false);
        });

        it("Should add the modifier to the key", function () {
            recallLocalStorage.set(recallLocalStorage.keys.LAST_SYNC, '1', 'test');
            $window.localStorage.setItem.calledWith(recallLocalStorage.keys.LAST_SYNC + '_test', '1').should.equal(true);
        });

        it("Should set the value in local storage if it is available", function () {
            recallLocalStorage.set(recallLocalStorage.keys.LAST_SYNC, '1');
            $window.localStorage.setItem.calledWith(recallLocalStorage.keys.LAST_SYNC, '1').should.equal(true);
            $document.cookie.should.equal("");
        });

        it("Should set the value as a cookie if local storage is not available", function () {
            sinon.stub(recallLocalStorage, 'supportsLocalStorage').returns(false);
            recallLocalStorage.set(recallLocalStorage.keys.LAST_SYNC, '1');
            $window.localStorage.setItem.called.should.equal(false);
            $document.cookie.should.equal(recallLocalStorage.keys.LAST_SYNC + "=1; max-age=" + life + ";");
        });
    });

    describe("get", function () {
        it("Should not do anything if the key does not exist", function () {
            sinon.stub(fakeLocalStorage, 'getItem').returns("test");
            sinon.stub(fakeLocalStorage, 'setItem');
            sinon.stub(fakeLocalStorage, 'removeItem');

            recallLocalStorage.get('test');
            $window.localStorage.getItem.called.should.equal(false);
        });

        it("Should add the modifier to the key", function () {
            sinon.stub(fakeLocalStorage, 'getItem').returns("test");
            sinon.stub(fakeLocalStorage, 'setItem');
            sinon.stub(fakeLocalStorage, 'removeItem');

            recallLocalStorage.get(recallLocalStorage.keys.LAST_SYNC, 'test');
            $window.localStorage.getItem.calledWith(recallLocalStorage.keys.LAST_SYNC + '_test').should.equal(true);
        });

        it("Should get the value from local storage if it is available", function () {
            sinon.stub(fakeLocalStorage, 'getItem').returns("test");
            sinon.stub(fakeLocalStorage, 'setItem');
            sinon.stub(fakeLocalStorage, 'removeItem');

            var result = recallLocalStorage.get(recallLocalStorage.keys.LAST_SYNC);
            $window.localStorage.getItem.calledWith(recallLocalStorage.keys.LAST_SYNC).should.equal(true);

            result.should.equal("test");
        });

        it("Should get the value from the cookie if local storage is not available", function () {
            sinon.stub(fakeLocalStorage, 'getItem').returns("test");
            sinon.stub(fakeLocalStorage, 'setItem');
            sinon.stub(fakeLocalStorage, 'removeItem');

            $document.cookie = recallLocalStorage.keys.LAST_SYNC + "=1; max-age=" + life + ";";
            sinon.stub(recallLocalStorage, 'supportsLocalStorage').returns(false);
            var result = recallLocalStorage.get(recallLocalStorage.keys.LAST_SYNC);
            $window.localStorage.getItem.called.should.equal(false);

            result.should.equal('1');
        });

        it("Should return an empty string if the key is not set in local storage", function () {
            sinon.stub(fakeLocalStorage, 'getItem').returns(null);
            sinon.stub(fakeLocalStorage, 'setItem');
            sinon.stub(fakeLocalStorage, 'removeItem');

            var result = recallLocalStorage.get(recallLocalStorage.keys.LAST_SYNC);
            $window.localStorage.getItem.calledWith(recallLocalStorage.keys.LAST_SYNC).should.equal(true);

            result.should.equal("");
        });

        it("Should return an empty string if the cookie is not set and local storage is not available", function () {
            sinon.stub(fakeLocalStorage, 'getItem').returns("test");
            sinon.stub(fakeLocalStorage, 'setItem');
            sinon.stub(fakeLocalStorage, 'removeItem');

            sinon.stub(recallLocalStorage, 'supportsLocalStorage').returns(false);
            var result = recallLocalStorage.get(recallLocalStorage.keys.LAST_SYNC);
            $window.localStorage.getItem.called.should.equal(false);

            result.should.equal('');
        });
    });

    describe("remove", function () {
        beforeEach(inject(function () {
            sinon.stub(fakeLocalStorage, 'getItem').returns("test");
            sinon.stub(fakeLocalStorage, 'setItem');
            sinon.stub(fakeLocalStorage, 'removeItem');
        }));

        it("Should not do anything if the key does not exist", function () {
            recallLocalStorage.remove('test');
            $window.localStorage.removeItem.called.should.equal(false);
        });

        it("Should add the modifier to the key", function () {
            recallLocalStorage.remove(recallLocalStorage.keys.LAST_SYNC, 'test');
            $window.localStorage.removeItem.calledWith(recallLocalStorage.keys.LAST_SYNC + '_test').should.equal(true);
        });

        it("Should remove the value from local storage if it is available", function () {
            recallLocalStorage.remove(recallLocalStorage.keys.LAST_SYNC);
            $window.localStorage.removeItem.calledWith(recallLocalStorage.keys.LAST_SYNC).should.equal(true);
        });

        it("Should set the max age to 0 in the cookie if local storage is not available", function () {
            $document.cookie = recallLocalStorage.keys.LAST_SYNC + "=1; max-age=" + life + ";";
            sinon.stub(recallLocalStorage, 'supportsLocalStorage').returns(false);
            recallLocalStorage.remove(recallLocalStorage.keys.LAST_SYNC);
            $window.localStorage.removeItem.called.should.equal(false);

            $document.cookie.should.equal(recallLocalStorage.keys.LAST_SYNC + "=; max-age=0;");
        });
    });

    describe("supportsLocalStorage", function () {
        it("Should return true if local storage is available", function () {
            recallLocalStorage.supportsLocalStorage().should.equal(true);
        });
    });
});