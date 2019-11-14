# Event Busses
Generates a collection of named event emitters that allow to configure a convenient pattern matching. 

## General usage
In order to generate the default busses, simply call the bus factory. The factory will always generate a `system` and `domain` bus.

```js
const busBuilder    = require('event-busses')
const defaultBusses = busBuilder()
const app           = {} 
const busses        = defaultBusses(app)

console.log(busses.names()) // ['system', 'domain']
```

If you need or want more bus categories, add them to your bus builder factory.

```js 

const busBuilder  = require('event-busses')
const buildBusses = busBuilder('testing', 'messaging')
const app         = {}
const busses      = buildBusses(app)

console.log(busses.names()) // ['system', 'domain', 'testing', 'messaging']
```

### Configuring 
Once generated, you can access your bus using the `onBus` method with the desired bus name as agrument. This will return the bus object or throw an error when the requested bus does not exist. 


```js 
const systemBus = busses.onBus('system')
```

#### the bus object
The bus object is a simple wrapper around an `EventEmitter` instance that provides a set of attributes and functions tied to the bus. 

| `bus`                           | type       |                                                                |
| ------------------------------- | ---------- | -------------------------------------------------------------- |
| `.name`                         | `string`   | the bus name (e.g. `"system"`).                                |
| `.emit(event, data)`            | `function` | Emits an event into the current bus.                           |
| `.emitTo(busName, event, data)` | `function` | Emits an event into the bus specified by the given `busName`.  |
| `.broadcast(event, data)`       | `function` | Emits the given event into every bus in the collection.        |
| `.$init(data)`                  | `function` | Emits the `$init` event into the current bus.                  |
| `.when(patterns)`               | `function` | Adds the given patterns as event listeners to the current bus. |

Since the bus object is just a simple object literal, it is safe to be destructured. 

```js 
    const { when, $init } = busses.onBus('system')
```

**the `when` function**

The `when` function expects an object literal where every key is expected to be the event name and the corresponding value is expected to be the event handler function. 
The event handler function will be called with a `context` object whenever the corresponding event occurs. 

**event handler `context` **

| `context`                       | type       |                                                                 |
| ------------------------------- | ---------- | --------------------------------------------------------------- |
| `.app`                          | `any`      | the _"app"_ object that was initially given to the bus builder. |
| `.data`                         | `any`      | The `data` that was sent with the event we're listening to      |
| `.emit(event, data)`            | `function` | Emits the event to the current bus.                             |
| `.emitTo(busName, event, data)` | `function` | Emits the given event to the bus specified by `busName`         |
| `.broadcast(event, data)`       | `function` | Emits the given event into every bus in the collection.         |

**the `$init` function/event** 

Although it is technically just an event like any other, it is intended to be used as initializer (hence the name). 
In fact, the listeners described in the `when` function will already be in effect before the `$init` function is called. 

### example : boot sequence 


```js 
const ConfigurationError = ({message}) => 
    Object.assign(
        new Error('Configuration could not be loaded.'), 
        {type: 'ECONFIG', reason: message}
    )

const AppBootError = ({message}) => 
    Object.assign(
        new Error('Application failed to boot.'), 
        {type: 'EBOOT', reason: message}
    )

/**
 *  setup the event sequence. 
 *  
 *  The following example code is mostly intended to showcase how the different call styles 
 * (sync, promsise, callback, etc.) used in nodejs can be normalized. 
 */

when({
    // Asynchronous :: Promise style
    $init: ({ emit }) => {
        loadConfiguration()
            .then(config => emit('ConfigurationLoaded', config))
            .catch(error => emit('BootError', ConfigurationError(error)))
    },
    // Synchronous 
    ConfigurationLoaded: ({ app, data, emit }) =>  {
        app.configure(data)
        emit('AppConfigured')
    },
    // Asynchronous :: callback style
    AppConfigured: ({ app, emit }) => {
        app.boot((err) => err ? emit('BootError', AppBootError(err)) : emit('AppBooted'))
    },
    // Asynchronous :: event style 
    AppBooted: ({ app, emit }) => {
        const server = app.listen(app.get('port'))
        server
            .on('listening', _ => emit('ServerRunning', server))
            .on('error',     e => emit('ServerError', e))
            .on('close',     _ => emit('ServerClosed'))

    },
    // data holds the server instance
    ServerRunning: ({data}) => {
        logger.info('Server running')
    },
    // data holds the error 
    BootError: ({ data }) => {
        logger.error('Unable to boot', data)
        process.exit()
    },
    ServerError: ()  => {},
    ServerClosed: () => {}
})

// export the $init function and let some other module start the whole thing

module.exports = $init

```

Alternatively, you could build your actual handlers in individual modules and compose them using `when`. This would make it much easier to test every handler in isolation.

Additionally, over time, you might accumulate a large set of individual handlers available to be composed into totally different behavior. 

```js 
// example with externally defined handlers 
// basically the same sequence as the previous example with inline handlers

const loadConfigFromAws = require('./config/aws') 
const configureFeathers = require('./app/configure-feathers')
const bootFeathersApp   = require('./app/boot-feathers')
const startServer       = require('./app/start-server')
const exitOnBootError   = require('./errors/exit-on-boot-error')


when({
    $init              : loadConfigFromAws,
    ConfigurationLoaded: configureFeathers,
    AppConfigured      : bootFeathersApp,
    AppBooted          : startServer,
    BootError          : exitOnBootError
    
})

```