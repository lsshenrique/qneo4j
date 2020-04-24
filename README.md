# qneo4j
A layer under the Neo4J driver with additional features to help queries, transaction and response parser.

## Installation
Using npm:
```shell
$ npm i @qualitech/qneo4j
```

## Usage
Create QNeo4j instance:
```javascript
const QNeo4j = require('@qualitech/qneo4j')

// simplest
const db = new QNeo4j({
    url: 'bolt://localhost:7687'
})

// full options
const db = new QNeo4j({
    url: 'bolt://localhost:7687',
    username: 'neo4j',       // default: 'neo4j'
    password: 'admin',       // default: 'admin'
    
    // description: if true, returns raw value of the Neo4j.
    raw: false,              // default: false,

    // description: closes the Neo4j driver after the execute method or transaction.
    autoCloseDriver: true,   // default: true

    // description: expects to receive a callback function. This callback is called every time an error occurs within the QNeo4j module.
    notifyError: (error, query) => console.log(error, query),
    
    // description: all configuration available to the driver Neo4j can be set here. See more https://neo4j.com/docs/driver-manual/current/client-applications/
    driverConfig: {
        // ... neo4j driver configuration
    }
})
```
  
#### Executing a cypher query
The simplest way:
```javascript
// Promise
db.execute('MATCH (person:Person) RETURN person').then(result => {
    // todo something...
})

// async/await:
let result = await db.execute('MATCH (person:Person) RETURN person')
```

The value of the execution result above would be:
```javascript
[{ 
    person: { 
        name: 'Alice',
        age: 34 
    }
}, 
{
    person: { 
        name: 'Bob',
        age: 36
    }
}]

// where:
result[0].person.name === 'Alice'
result[1].person.name === 'Bob'
```

Executing multiple cypher queries through an array. The result will be an array containing the value of its query:
```javascript
const queries = [
    'CREATE (p:Person {name: "Bob"}) return p', 
    'CREATE (p:Person {name: "Ana"}) return p'
]

db.execute(queries).then(result => {
    console.log(result.length) // 2
})
```

Executing a cypher query with its parameters:
```javascript
const cypher = 'CREATE (p:Person {name: $name}) return p'
const params = { name: "Bob" }

db.execute({ cypher: cypher, params: params}).then(result => {
    // todo something...
})
```

Through a transaction scope:
```javascript
db.transaction(async function (execute, tx){
    // todo something...
    
    let result = await execute('CREATE (p:Person {name: "Bob"}) return p')

    // todo something...

    let result2 = await execute('CREATE (p:Person {name: "Alice"}) return p')

    // todo something...
})
```
- The transaction method returns a Promise;
- If you want to return any value to Promise, simply return the value within the transaction scope, so the value is sent to the Promise;
- At the end of the transaction scope, if all went well, the commit will be automatically performed, if there are unhandled exceptions the rollback is performed. You can also manually perfom the rollback using the given parameter `tx` by calling `tx.rollback()`. 

To get the raw return of Neo4j just apply some of the settings:
```javascript
// all queries will return the raw result
let db = new QNeo4j({
    raw: true
    // ... other options
})

// OR - only raw result
db.execute('MATCH (person:Person) RETURN person', { raw: QNeo4j.RETURN_TYPES.RAW })

// OR - raw result and parsed together
db.execute('MATCH (person:Person) RETURN person', { raw: QNeo4j.RETURN_TYPES.PARSER_RAW })
```

## Methods
#### createDriver
Creates a Neo4j driver with the informed authentication when instantiating the QNeo4j class. The createDriver method is used internally.

#### execute
Executes a cypher query and returns a Promise with the query result. See the examples that were mentioned in the documentation above.

#### transaction
Can executes various operations within a transactional scope, when this scope is completed commit is performed otherwise, if there are unhandled exceptions the rollback is performed. See the examples that were mentioned in the documentation above.

#### updateOptions 
Update the QNeo4j instance options
```javascript
let db = new QNeo4j()

db.updateOptions({
    url: 'bolt://localhost:7687',
    username: 'neo4j',       
    password: 'admin',       
    raw: false,              
    autoCloseDriver: true,   
    notifyError: (error, query) => console.log(error, query),
})
```

## Other Resources
#### Result Class
In some cases we will have the `Result` class as return from an execute method, such as when we return the raw and parsed result, this data is available through the `rawResult` properties and `value`.
```javascript
db.execute('MATCH (person:Person) RETURN person', { raw: QNeo4j.RETURN_TYPES.PARSER_RAW })
    .then(result => {
        console.log(result instanceOf QNeo4j.Result) // true
		console.log(result.rawResult) 	// raw result of the Neo4j
        console.log(result.value)        	// parsed result
    })
```
#### RETURN_TYPES constant 
The `RETURN_TYPES` constant is available on `QNeo4j.RETURN_TYPES`, it contains the options that specify how it will be the return type (raw, parsed or both).
```javascript
const QNeo4j = require('@qualitech/qneo4j')
const { RETURN_TYPES } = QNeo4j

console.log(RETURN_TYPES)
// {
//     PARSER: 0,
//     PARSER_RAW: 1,
//     RAW: 2
// }
```

#### Module QNeo4jHelper
The `qneo4j-helper` module is accessible from `QNeo4j.helper` and provides useful methods that help you work with cypher query and neo4j driver.

## QNeo4jHelper
This module focuses on making using Neo4j for JavaScript easier by making its coding cleaner and shorter.

- Functions for date conversions:
	- Neo4j date to native javascript date;
	- Neo4j date to [momentjs](https://momentjs.com/ "momentjs");
	- date in string format to Neo4j date and also cypher syntax;
	- native javascript date to Neo4j date and also cypher syntax;
	- [momentjs](https://momentjs.com/ "momentjs") to Neo4j date and also cypher syntax;
- Parse Neo4j response records to simple object;
- Transforms objects in string to help create cypher queries;


## Usage

Object to string:
``` javascript
let obj = {
    prop1: "value",
    prop2: "value2"
}
helper.objToString(obj) // returns '{prop1:"value",prop2:"value2"}'
```

------------

Object to params:
``` javascript
let obj = {
    prop1: "value",
    prop2: "value2"
}
helper.objToParams("prefix", obj) // returns '{prefix.prop1:"value",prefix.prop2:"value2"}'
```

------------

Checks if the value is a neo4j date type:
``` javascript
let date = "2019/02/08"
helper.isDateTypeNeo4j(date) // returns false

let date2 = neo4j.types.DateTime.fromStandardDate(new Date())
helper.isDateTypeNeo4j(date2) // returns true
```

------------

Converts a Neo4j date to a native JavaScript date
``` javascript
let dateNeo4j = neo4j.types.DateTime.fromStandardDate(new Date())
let date = helper.toStandardDate(dateNeo4j) // returns a date object 
date instanceof Date // returns true
```

------------

Converts a Neo4j date to a moment object
``` javascript
let dateNeo4j = neo4j.types.DateTime.fromStandardDate(new Date())
let date = helper.toMoment(dateNeo4j) // returns a moment object 
date instanceof moment // returns true
```

------------

Parse any date (string, native js, moment, neo4j, number) to Neo4j date:
``` javascript
let dateToParse = "30/07/2019" // DD/MM/YYYY
// or
let dateToParse = new Date(2019, 6, 30) // native JavaScript date
// or
let dateToParse = moment("30/07/2019") // moment date
// or
let dateToParse = neo4j.types.DateTime.fromStandardDate(new Date(2019, 6, 30)) // Neo4j date

// THEN:
let date = helper.parseDate(dateSource) // returns a Neo4j LocalDateTime

// more options...
let dateToParse = 201907 // any format that can be informed, format: YYYYMM
let date = helper.parseDate(dateToParse, DATE_TYPE.LOCAL_DATE_TIME, "YYYYMM") // returns "Date('2019-07-01')"
// returns a Neo4j LocalDateTime
```
Its possible to inform the Neo4j date type to return, the options are:
- LOCAL_TIME
- TIME
- DATE
- LOCAL_DATE_TIME
- DATE_TIME

``` javascript
const { DATE_TYPE } = helper
let date = helper.parseDate(dateSource, DATE_TYPE.DATE) // returns a Neo4j Date
```

------------

Parse any date (string, native js, moment, neo4j, number) to cypher syntax:
``` javascript
let dateToParse = "30/07/2019" // DD/MM/YYYY
// or
let dateToParse = new Date(2019, 6, 30) // native JavaScript date
// or
let dateToParse = moment("30/07/2019") // moment date
// or
let dateToParse = neo4j.types.DateTime.fromStandardDate(new Date(2019, 6, 30)) // Neo4j date
// or
let dateToParse = Date.now() // timestamp

// THEN:
let date = helper.parseDateCypher(dateSource) // returns "LocalDateTime('2019-07-30T00:00:00.000Z')"

// its possible to inform the Neo4j date type to return
let date = helper.parseDateCypher(dateSource, DATE_TYPE.DATE) // returns "Date('2019-07-30')"

// more options...
let dateToParse = 201907 // any format that can be informed, format: YYYYMM
let date = helper.parseDateCypher(dateToParse, DATE_TYPE.DATE, "YYYYMM") // returns "Date('2019-07-01')"
```
Its possible to inform the Neo4j date type to return, the options are:
- LOCAL_TIME
- TIME
- DATE
- LOCAL_DATE_TIME
- DATE_TIME

``` javascript
const { DATE_TYPE } = helper
let date = helper.parseDate(dateSource, DATE_TYPE.DATE) // returns a Neo4j Date
```

------------

Parse the Neo4j response to a json structure:
```javascript
// Original Neo4j Result:
Record {
    keys: [ 'myNode' ],
    length: 1,
    _fields: [ { prop2: 'value2', prop1: 'value1' } ],
    _fieldLookup: { myNode: 0 }
}

// Parsed Result:
{ 
    myNode: { 
        prop2: 'value2',
        prop1: 'value1'
    }
}
```

``` javascript
const driver = neo4j.driver(/*auth and options*/)
const session = driver.session();

let result = await session.run(`return { prop1: "value1", prop2: "value2" } as myNode`)
let parsed = helper.parseResponse(result)

console.log(parsed.myNode.prop2) // returns "value2"
```
