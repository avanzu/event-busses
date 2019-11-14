const eventBusses = require('./index')
const buildBusses = eventBusses()

describe('Event stream collection', () => {

    it('should build different named streams', () => {
      
        const buildMoreBusses = eventBusses('testing', 'foo')
        expect(buildMoreBusses({}).names())
            .toEqual(['system', 'domain', 'testing', 'foo'])

    })

    it('should provide a stream selection', () => {
        const busses = buildBusses({})
        expect(busses.onBus('system')).toMatchObject({
            name: 'system',
            emit: expect.any(Function),
            when: expect.any(Function)
        })
    })

    it('should throw "StreamNotFound" errors for streams that do not exist', () => {
        const expectedError = Object.assign(new Error('Stream "testing" does not exist'), { type: 'E_STREAMNAME' })
        const busses = buildBusses({})
        expect(() => busses.onBus('testing')).toThrowError(expectedError)
    })

    it('should add listeners to event patterns', done => {
        
        const busses = buildBusses({})
        const {name, when, $init} = busses.onBus('system')
        expect(name).toEqual('system')

        when({
            $init({data, emit}) {
                expect(data).not.toBeDefined()
                emit('Initialized', { test: 'test' })
            },
            Initialized({app, data, emit}) {
                expect(data).toEqual({test: 'test'})
                app.ready = true
                emit('Tested')
            },
            Tested({ app, emit }){
                expect(app.ready).toEqual(true)
                emit('Done')
            },
            Done() {
                done()
            }
        })

        $init()

    })

    test('emitting events between busses', done => {

        const busses = buildBusses({})
        busses.onBus('system').when({
            $init: ({emitTo}) => {
                emitTo('domain', 'Foo', {foo: 'bar'})
            },
            Broadcasted: ({data}) => {
                expect(data).toEqual({ fromDomain: true })
                done()
            }
        })

        busses.onBus('domain').when({
            Foo: ({data, emit}) => {
                expect(data).toEqual({foo: 'bar'})
                emit('FooHappened')
            },
            FooHappened: ({broadcast}) => {
                broadcast('Broadcasted', { fromDomain: true})
            }
        })

        busses.onBus('system').$init()

    })
})