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

#### Modulo QHelper
The `qneo4j-helper` module is accessible from `QNeo4j.helper` and provides useful methods that help you work with cypher query and neo4j driver. See more in the module's own [documentation](https://www.npmjs.com/package/@qualitech/qneo4j-helper "documentation").