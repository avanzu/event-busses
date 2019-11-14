const EventEmitter = require('events')
// const { defaultTo } = require('ramda')

const BusNotFound = name => Object.assign(new Error(`Stream "${name}" does not exist`), { type: 'E_STREAMNAME' })
const throwBusNotFound = name => { throw BusNotFound(name) }
const busCollection = collection => name => collection[name] ? collection[name] : throwBusNotFound(name)

const eventBus = (name, app, busses) => {

    const bus       = new EventEmitter()
    const emit      = (name, value) => bus.emit(name, value)
    const $init     = data => emit('$init', data)
    const emitTo    = (bus, event, data) => busCollection(busses)(bus).emit(event, data)
    const broadcast = (event, data) => Object.keys(busses).map( busName => emitTo(busName, event, data))

    const when = patterns =>
        Object.keys(patterns)
            .map(event => ({ event, handle: patterns[event] }))
            .reduce((bus, { event, handle }) => bus.on(event, data => handle({ app, data, emit, emitTo, broadcast })), bus)

    return { name, when, emit, $init, emitTo, broadcast }
}

module.exports = (...busses) => app => {

    const collection = ['system', 'domain']
        .concat(busses)
        .reduce((busses, name) => Object.assign(busses, { [name]: eventBus(name, app, busses) }), {})

    const onBus = busCollection(collection)
    const names = () => Object.keys(collection)

    return { onBus, names }
}