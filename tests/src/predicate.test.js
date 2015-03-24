/*globals describe, beforeEach, module, inject, it, should*/
describe("Predicate", function () {

    beforeEach(module('recall'));

    var Predicate;

    beforeEach(inject(function (recallPredicate) {
        Predicate = recallPredicate;
    }));

    var predicate;

    describe("Constructing a new Predicate", function () {
        it("Should initialize the predicate properties", function () {
            predicate = new Predicate("property").equals('value');

            should.equal(undefined, predicate.joinedPredicates);
            predicate.property.should.equal("property");

            predicate.parser().should.equal("property eq 'value'");
        });
    });

    describe("Class level .join()", function () {
        it("Should create and return new Predicate", function () {
            var first = new Predicate("property1").equals('value');
            var second = new Predicate("property2").equals('value');
            var returned = Predicate.join([first, second]);

            should.equal(true, returned instanceof Predicate);
        });

        it("Should set the new Predicate's group operator", function () {
            var first = new Predicate("property1").equals('value');
            var second = new Predicate("property2").equals('value');
            var returned = Predicate.join([first, second], 'or');

            returned.groupOperator.should.equal('or');
        });

        it("Should only accept an array of predicates", function () {
            var first = new Predicate("property1").equals('value');
            var second = new Predicate("property2").equals('value');
            var returned;

            returned = Predicate.join("string");
            should.equal(null, returned);

            returned = Predicate.join(first);
            should.equal(null, returned);

            returned = Predicate.join(1);
            should.equal(null, returned);

            returned = Predicate.join([first, second]);
            returned.joinedPredicates.length.should.equal(2);
        });

        it("Should add the predicates to the predicates array", function () {
            var first = new Predicate("property1").equals('value');
            var second = new Predicate("property2").equals('value');
            var returned = Predicate.join([first, second]);

            returned.joinedPredicates.length.should.equal(2);
            returned.joinedPredicates[0].property.should.equal("property1");
            returned.joinedPredicates[1].property.should.equal("property2");
        });
    });

    describe("Instance level .join()", function () {
        it("Should return the original predicate", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional = new Predicate("property2").equals('value');
            var returned = predicate.join(additional);

            should.equal(returned, predicate);
        });

        it("Should set the original Predicate's group operator", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional = new Predicate("property2").equals('value');
            var returned = predicate.join(additional, 'or');

            returned.groupOperator.should.equal('or');
        });

        it("Should clear the values of the original predicate", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional = new Predicate("property2").equals('value');
            predicate.join(additional);

            should.equal(undefined, predicate.property);
            should.equal(undefined, predicate.parser);
        });

        it("Should accept a predicate", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional = new Predicate("property2").equals('value');

            predicate.join("string");
            should.equal(undefined, predicate.joinedPredicates);

            predicate.join(1);
            should.equal(undefined, predicate.joinedPredicates);

            predicate.join(additional);
            predicate.joinedPredicates.length.should.equal(2);
        });

        it("Should accept an array of predicates", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional1 = new Predicate("property2").equals('value');
            var additional2 = new Predicate("property3").equals('value');

            predicate.join("string");
            should.equal(undefined, predicate.joinedPredicates);

            predicate.join(1);
            should.equal(undefined, predicate.joinedPredicates);

            predicate.join([additional1, additional2]);
            predicate.joinedPredicates.length.should.equal(3);
        });

        it("Should add the predicates to the predicates array", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional = new Predicate("property2").equals('value');
            predicate.join(additional);

            predicate.joinedPredicates.length.should.equal(2);
            predicate.joinedPredicates[0].property.should.equal("property1");
            predicate.joinedPredicates[1].property.should.equal("property2");
        });
    });

    describe(".and", function () {
        it("Should join two predicates with the and operator", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional = new Predicate("property2").equals('value');
            predicate.and(additional);

            predicate.joinedPredicates.length.should.equal(2);
            predicate.groupOperator.should.equal('and');
            predicate.joinedPredicates[0].property.should.equal("property1");
            predicate.joinedPredicates[1].property.should.equal("property2");
        });
    });

    describe(".and", function () {
        it("Should join two predicates with the or operator", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional = new Predicate("property2").equals('value');
            predicate.or(additional);

            predicate.joinedPredicates.length.should.equal(2);
            predicate.groupOperator.should.equal('or');
            predicate.joinedPredicates[0].property.should.equal("property1");
            predicate.joinedPredicates[1].property.should.equal("property2");
        });
    });

    describe(".equals", function () {
        it("Should take a value and set the parser", function () {
            var predicate = new Predicate("property").equals("value");
            predicate.parser().should.equal("property eq 'value'");
        });
    });

    describe(".notEqualTo", function () {
        it("Should take a value and set the operator", function () {
            var predicate = new Predicate("property").notEqualTo("value");
            predicate.parser().should.equal("property ne 'value'");
        });
    });

    describe(".greaterThan", function () {
        it("Should take a value and set the operator", function () {
            var predicate = new Predicate("property").greaterThan("value");
            predicate.parser().should.equal("property gt 'value'");
        });
    });

    describe(".greaterThanOrEqualTo", function () {
        it("Should take a value and set the operator", function () {
            var predicate = new Predicate("property").greaterThanOrEqualTo("value");
            predicate.parser().should.equal("property ge 'value'");
        });
    });

    describe(".lessThan", function () {
        it("Should take a value and set the operator", function () {
            var predicate = new Predicate("property").lessThan("value");
            predicate.parser().should.equal("property lt 'value'");
        });
    });

    describe(".lessThanOrEqualTo", function () {
        it("Should take a value and set the operator", function () {
            var predicate = new Predicate("property").lessThanOrEqualTo("value");
            predicate.parser().should.equal("property le 'value'");
        });
    });

    describe(".startsWith", function () {
        it("Should parse the correct url string", function () {
            var predicate = new Predicate("property").startsWith("value");
            predicate.parser().should.equal("startswith(property, 'value')");
        });
    });

    describe(".endsWith", function () {
        it("Should parse the correct url string", function () {
            var predicate = new Predicate("property").endsWith("value");
            predicate.parser().should.equal("endswith(property, 'value')");
        });
    });

    describe(".contains", function () {
        it("Should parse the correct url string", function () {
            var predicate = new Predicate("property").contains("value");
            predicate.parser().should.equal("substringof('value', property)");
        });
    });

    describe(".test", function () {
        it("Should return true if the object matches the predicate", function () {
            var today = Date.now();
            var object = {
                prop1: 'test',
                prop2: 12,
                prop3: false,
                prop4: null,
                prop5: {
                    sub1: 'test',
                    sub2: true
                },
                prop6: today,
                prop7: today.toString()
            };

            var predicate = new Predicate("prop1").contains("es");
            predicate.test(object).should.equal(true);

            predicate = new Predicate("prop1").contains("es").or(new Predicate('prop2').greaterThan(13));
            predicate.test(object).should.equal(true);

            predicate = new Predicate("prop1").contains("es").and(new Predicate('prop2').greaterThan(13));
            predicate.test(object).should.equal(false);

            predicate = new Predicate("prop1").contains("es").and(new Predicate('prop2').greaterThan(13).or(new Predicate('prop3').equals(false)));
            predicate.test(object).should.equal(true);

            predicate = new Predicate("prop4").notEqualTo("test");
            predicate.test(object).should.equal(true);

            predicate = new Predicate("prop5.sub1").contains("es");
            predicate.test(object).should.equal(true);

            var yesterday = new Date();
            yesterday = yesterday.setDate(yesterday.getDate() - 1).toString();
            var tomorrow = new Date();
            tomorrow = tomorrow.setDate(tomorrow.getDate() + 1).toString();

            predicate = new Predicate("prop6").greaterThan(yesterday);
            predicate.test(object).should.equal(true);

            predicate = new Predicate("prop7").lessThan(tomorrow);
            predicate.test(object).should.equal(true);

            predicate = new Predicate("prop6").greaterThanOrEqualTo(today.toString());
            predicate.test(object).should.equal(true);

            predicate = new Predicate("prop7").lessThanOrEqualTo(today.toString());
            predicate.test(object).should.equal(true);

            predicate = new Predicate("prop6").equals(today.toString());
            predicate.test(object).should.equal(true);

            predicate = new Predicate("prop7").equals(today.toString());
            predicate.test(object).should.equal(true);

            predicate = new Predicate("prop8").equals('test');
            predicate.test(object).should.equal(false);
        });
    });

    describe(".parsePredicate()", function () {
        it("Should return a string for a simple predicate", function () {
            var predicate = new Predicate("property1").equals("value");
            var urlString = predicate.parsePredicate();

            urlString.should.equal("property1 eq 'value'");
        });

        it("Should quote string values", function () {
            var predicate = new Predicate("property1").equals("value");
            var urlString = predicate.parsePredicate();

            urlString.should.equal("property1 eq 'value'");
        });

        it("Should not quote int values", function () {
            var predicate = new Predicate("property1").equals(1);
            var urlString = predicate.parsePredicate();

            urlString.should.equal("property1 eq 1");
        });

        it("Should not quote boolean values", function () {
            var predicate = new Predicate("property1").equals(true);
            var urlString = predicate.parsePredicate();

            urlString.should.equal("property1 eq true");

            predicate = new Predicate("property1").equals(false);
            urlString = predicate.parsePredicate();

            urlString.should.equal("property1 eq false");
        });

        it("Should return a string when an existing predicate is joined", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional = new Predicate("property2").equals(1);
            predicate.join(additional);

            var urlString = predicate.parsePredicate();

            urlString.should.equal("property1 eq 'value' and property2 eq 1");
        });

        it("Should return a string when predicates are joined", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional = new Predicate("property2").equals(false);
            var joinedPredicate = Predicate.join([predicate, additional]);

            var urlString = joinedPredicate.parsePredicate();

            urlString.should.equal("property1 eq 'value' and property2 eq false");
        });

        it("Should allow setting the group operator when predicates are joined", function () {
            var predicate = new Predicate("property1").equals('value');
            var additional = new Predicate("property2").equals(false);
            var joinedPredicate = Predicate.join([predicate, additional], 'or');

            var urlString = joinedPredicate.parsePredicate();

            urlString.should.equal("property1 eq 'value' or property2 eq false");
        });
    });

    describe("class.fromString", function () {
        it("Should take a string and return a predicate", function () {
            var urlString = "property1 gt 5 and (property2 eq false or startswith(property3, 'test'))";
            var predicate = Predicate.fromString(urlString);
            var parsed = predicate.parsePredicate();

            parsed.should.equal(urlString);

            urlString = "substringof('test', prop1) or substringof('test', prop2) or substringof('test', prop3)";
            predicate = Predicate.fromString(urlString);
            parsed = predicate.parsePredicate();

            parsed.should.equal(urlString);

            urlString = "substringof('test', prop1)";
            predicate = Predicate.fromString(urlString);
            parsed = predicate.parsePredicate();

            parsed.should.equal(urlString);

            urlString = "substringof('test', prop1) or (prop2 eq 3 and (prop3 eq 4 and prop4.a eq 6)) or (startswith(prop5, 'test') and prop6 lt 100)";
            predicate = Predicate.fromString(urlString);
            parsed = predicate.parsePredicate();

            parsed.should.equal(urlString);
        });

        it("Should return null when given an invalid string", function () {
            var urlString = "";
            should.equal(Predicate.fromString(urlString), null);

            urlString = "foo";
            should.equal(Predicate.fromString(urlString), null);

            urlString = 21;
            should.equal(Predicate.fromString(urlString), null);

            urlString = false;
            should.equal(Predicate.fromString(urlString), null);

            urlString = "prop1 gt 5 and foo";
            should.equal(Predicate.fromString(urlString), null);

            urlString = "prop1 gt 5 and prop2 eq 4 or prop3 eq 5";
            should.equal(Predicate.fromString(urlString), null);

            urlString = "prop1 gt 5 and prop2 eq 4 and (prop3 eq 5";
            should.equal(Predicate.fromString(urlString), null);
        });

        it("Should create a predicate from a string and allow modification", function () {
            var urlString = "property1 gt 5 and (property2 eq false or startswith(property3, 'test'))";
            var predicate = Predicate.fromString(urlString);
            var primaryPredicate = new Predicate('property').contains('test').join(predicate, 'or');
            var parsed = primaryPredicate.parsePredicate();

            parsed.should.equal("substringof('test', property) or (property1 gt 5 and (property2 eq false or startswith(property3, 'test')))");
        });
    });
});