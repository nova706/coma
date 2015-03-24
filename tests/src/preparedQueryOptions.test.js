/*globals describe, beforeEach, module, inject, it, should*/
describe("PreparedQueryOptions", function () {

    beforeEach(module('recall'));

    var PreparedQueryOptions;
    var Predicate;

    beforeEach(inject(function (recallPreparedQueryOptions, recallPredicate) {
        PreparedQueryOptions = recallPreparedQueryOptions;
        Predicate = recallPredicate;
    }));

    var preparedQueryOptions;

    describe(".$top()", function () {
        it("Should require a number greater than or equal to 0", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$top(-1);

            should.not.exist(preparedQueryOptions.options.$top);

            preparedQueryOptions.$top('string');

            should.not.exist(preparedQueryOptions.options.$top);

            preparedQueryOptions.$top(0);

            preparedQueryOptions.options.$top.should.equal(0);
        });

        it("Should return preparedQueryOptions", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$top(10);

            should.exist(preparedQueryOptions.options);
        });

        it("Should return the current value if the argument is negated", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$top(10);

            preparedQueryOptions.$top().should.equal(10);
        });

        it("Should clear the current value if the value is null", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$top(10);
            preparedQueryOptions.$top(null);

            should.equal(preparedQueryOptions.$top(), null);
        });
    });

    describe(".$skip()", function () {
        it("Should require a number greater than or equal to 0", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$skip(-1);

            should.not.exist(preparedQueryOptions.options.$skip);

            preparedQueryOptions.$skip('string');

            should.not.exist(preparedQueryOptions.options.$skip);

            preparedQueryOptions.$skip(0);

            preparedQueryOptions.options.$skip.should.equal(0);
        });

        it("Should return preparedQueryOptions", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$skip(10);

            should.exist(preparedQueryOptions.options);
        });

        it("Should return the current value if the argument is negated", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$skip(10);

            preparedQueryOptions.$skip().should.equal(10);
        });

        it("Should clear the current value if the value is null", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$skip(10);
            preparedQueryOptions.$skip(null);

            should.equal(preparedQueryOptions.$skip(), null);
        });
    });

    describe(".$orderBy()", function () {
        it("Should require a string", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$orderBy(0);

            should.not.exist(preparedQueryOptions.options.$orderby);

            preparedQueryOptions.$orderBy('column');

            preparedQueryOptions.options.$orderby.should.equal('column');
        });

        it("Should return preparedQueryOptions", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$orderBy('column');

            should.exist(preparedQueryOptions.options);
        });

        it("Should return the current value if the argument is negated", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$orderBy('column');

            preparedQueryOptions.$orderBy().should.equal('column');
        });

        it("Should clear the current value if the value is null", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$orderBy('column');
            preparedQueryOptions.$orderBy(null);

            should.equal(preparedQueryOptions.$orderBy(), null);
        });
    });

    describe(".$expand()", function () {
        it("Should take a string", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$expand(0);

            should.not.exist(preparedQueryOptions.options.$expand);

            preparedQueryOptions.$expand('foreignKey');

            preparedQueryOptions.options.$expand.should.equal('foreignKey');
        });

        it("Should take an array of strings", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$expand(['test', 'test2']);
            preparedQueryOptions.options.$expand.should.equal('test,test2');
        });

        it("Should return preparedQueryOptions", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$expand('foreignKey');

            should.exist(preparedQueryOptions.options);
        });

        it("Should return the current value if the argument is negated", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$expand("foreignKey");

            preparedQueryOptions.$expand().should.equal("foreignKey");
        });

        it("Should clear the current value if the value is null", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$expand('foreignKey');
            preparedQueryOptions.$expand(null);

            should.equal(preparedQueryOptions.$expand(), null);
        });
    });

    describe(".$select()", function () {
        it("Should take a string", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$select(0);

            should.not.exist(preparedQueryOptions.options.$select);

            preparedQueryOptions.$select('prop1');

            preparedQueryOptions.options.$select.should.equal('prop1');
        });

        it("Should take an array of strings", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$select(['prop1', 'prop2']);
            preparedQueryOptions.options.$select.should.equal('prop1,prop2');
        });

        it("Should return preparedQueryOptions", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$select('prop1');

            should.exist(preparedQueryOptions.options);
        });

        it("Should return the current value if the argument is negated", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$select('prop');

            preparedQueryOptions.$select().should.equal('prop');
        });

        it("Should clear the current value if the value is null", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$select('prop');
            preparedQueryOptions.$select(null);

            should.equal(preparedQueryOptions.$select(), null);
        });
    });

    describe(".$inlineCount()", function () {
        it("Should take a boolean and default to true unless false is specified", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$inlineCount(true);

            preparedQueryOptions.options.$inlinecount.should.equal('allpages');

            preparedQueryOptions.$inlineCount(0);

            preparedQueryOptions.options.$inlinecount.should.equal('allpages');

            preparedQueryOptions.$inlineCount(false);

            should.not.exist(preparedQueryOptions.options.$inlinecount);
        });

        it("Should return preparedQueryOptions", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$inlineCount();

            should.exist(preparedQueryOptions.options);
        });

        it("Should return the current value if the argument is negated", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$inlineCount(true);

            preparedQueryOptions.$inlineCount().should.equal('allpages');
        });

        it("Should clear the current value if the value is null", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$inlineCount(true);
            preparedQueryOptions.$inlineCount(null);

            should.equal(preparedQueryOptions.$inlineCount(), null);
        });
    });

    describe(".$filter()", function () {
        it("Should take a string", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$filter(0);

            should.not.exist(preparedQueryOptions.options.$filter);

            preparedQueryOptions.$filter('age gt 21');

            preparedQueryOptions.options.$filter.parsePredicate().should.equal('age gt 21');
        });

        it("Should take a Predicate", function () {
            var pred = new Predicate('age').greaterThan(21);
            var fakePredicate = {
                prop: "test"
            };
            preparedQueryOptions = new PreparedQueryOptions();

            preparedQueryOptions.$filter(fakePredicate);
            should.not.exist(preparedQueryOptions.options.$filter);

            preparedQueryOptions.$filter(pred);
            preparedQueryOptions.options.$filter.parsePredicate().should.equal('age gt 21');
        });

        it("Should return preparedQueryOptions", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$filter('clause');

            should.exist(preparedQueryOptions.options);
        });

        it("Should return the current value if the argument is negated", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$filter('age gt 21');

            preparedQueryOptions.$filter().parsePredicate().should.equal('age gt 21');
        });

        it("Should clear the current value if the value is null", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$filter('age gt 21');
            preparedQueryOptions.$filter(null);

            should.equal(preparedQueryOptions.$filter(), null);
        });
    });

    describe(".custom()", function () {
        it("Should require strings representing the option name and value", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.custom('test', 0);

            should.not.exist(preparedQueryOptions.options.test);

            preparedQueryOptions.custom('test', '0');
            preparedQueryOptions.options.test.should.equal('0');

            preparedQueryOptions.custom('test', 10);
            preparedQueryOptions.options.test.should.equal(10);

            preparedQueryOptions.custom('test', true);
            preparedQueryOptions.options.test.should.equal(true);
        });

        it("Should ignore options if the option name starts with $", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.custom('$test', '0');

            should.not.exist(preparedQueryOptions.options.$test);
        });

        it("Should return preparedQueryOptions", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.custom('test', '0');

            should.exist(preparedQueryOptions.options);
        });

        it("Should return the current value if the argument is negated", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.custom('test', 10);

            preparedQueryOptions.custom('test').should.equal(10);
        });

        it("Should clear the current value if the value is null", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.custom('test', 10);
            preparedQueryOptions.custom('test', null);

            should.equal(preparedQueryOptions.custom('test'), null);
        });
    });

    describe(".extend()", function () {
        it("Should return the preparedQueryOptions with extended options", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$filter('age eq 20');

            var moreOptions = new PreparedQueryOptions();
            moreOptions.$skip(10);

            preparedQueryOptions.options.$filter.parsePredicate().should.equal('age eq 20');
            should.not.exist(preparedQueryOptions.options.$skip);

            preparedQueryOptions.extend(moreOptions);

            preparedQueryOptions.options.$filter.parsePredicate().should.equal('age eq 20');
            preparedQueryOptions.options.$skip.should.equal(10);
        });

        it("Should not alter the preparedQueryOptions that are passed in", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$filter('clause');

            var moreOptions = new PreparedQueryOptions();
            moreOptions.$skip(10);

            preparedQueryOptions.extend(moreOptions);
            should.not.exist(moreOptions.options.$filter);
        });

        it("Should override existing options", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$skip(0);

            var moreOptions = new PreparedQueryOptions();
            moreOptions.$skip(10);

            preparedQueryOptions.extend(moreOptions);
            preparedQueryOptions.options.$skip.should.equal(10);
        });
    });

    describe(".parseOptions()", function () {
        it("Should return a proper URL parameter string for the set of options", function () {
            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$expand('foreignKey');
            preparedQueryOptions.$select(['prop1', 'prop2']);
            preparedQueryOptions.$orderBy('column');
            preparedQueryOptions.$skip(0);
            preparedQueryOptions.$top(10);
            preparedQueryOptions.$filter('age eq 20');
            preparedQueryOptions.$inlineCount(true);

            var paramString = preparedQueryOptions.parseOptions();
            paramString.should.equal("?$expand=foreignKey&$select=prop1,prop2&$orderby=column&$skip=0&$top=10&$filter=age eq 20&$inlinecount=allpages");
        });

        it("Should return a proper URL parameter string for a predicate", function () {
            var pred = new Predicate('age').greaterThan(21);
            var expected = pred.parsePredicate();

            preparedQueryOptions = new PreparedQueryOptions();
            preparedQueryOptions.$filter(pred);

            var paramString = preparedQueryOptions.parseOptions();
            paramString.should.equal("?$filter=" + expected);
        });
    });

    describe("class.fromObject()", function () {
        it("Should return a preparedQueryOptions object from a simple object", function () {
            var obj = {
                foo: "bar",
                "$top": 10,
                $skip: 20,
                $filter: "prop gt 'value'"
            };

            var preparedQueryOptions = PreparedQueryOptions.fromObject(obj);

            var paramString = preparedQueryOptions.parseOptions();
            paramString.should.equal("?$top=10&$skip=20&$filter=prop gt 'value'");
        });
    });

});