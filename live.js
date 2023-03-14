const Live = Object.defineProperties({}, {
    version: {configurable: false, enumerable: true, writable: false, value: '1.0.0'},
    maxDelay: {configurable: false, enumerable: true, writable: true, value: 1000},
    listeners: {configurable: false, enumerable: true, writable: false, value: {}},
    processors: {configurable: false, enumerable: true, writable: false, value: {}},
    _subscriptions: {configurable: false, enumerable: false, writable: false, value: {}},
    _triggers: {configurable: false, enumerable: false, writable: false, value: {}},
    _b37LiveObserver: {configurable: false, enumerable: false, writable: true, value: undefined},
    fromElements: {configurable: false, enumerable: true, writable: false, value: {}},
    _configureTrigger: {configurable: false, enumerable: false, writable: false, value: function(addOrRemove, toElement, toValue, toOptions) {
        const givenToValue = toValue
        toValue.includes(':') || (toValue = `:${toValue}`)
        let [eventName, processorName] = toValue.split(':')
        eventName ||= (['HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement']).includes(toElement.constructor.name) && 'change' || 'click'
        this._triggers[toElement] ||= {}
        if (addOrRemove==='remove' && this._triggers[toElement][givenToValue]) {
            toElement.removeEventListener(...this._triggers[toElement][givenToValue])
        } else {
            this._triggers[toElement][givenToValue] = [eventName, event => (this.processors[processorName]?.trigger || (() => undefined))(toElement, event, toOptions), toOptions]
            toElement.addEventListener(...this._triggers[toElement][givenToValue])
        }
    }},
    _parseToAttribute: {configurable: false, enumerable: false, writable: false, value: function(toElement) {
        const toOptionsList = (toElement.getAttribute('b37-to-options')||'').split(' '),
            toValuesList = (toElement.getAttribute('b37-to')||'').split(' '), toParams = [],
            toOptionsParsedList = []
        for (let toValueIndex=0,toValuesListLength = toValuesList.length; toValueIndex < toValuesListLength; ++toValueIndex) {
            let toOptionsParam = toOptionsList[toValueIndex]
            toOptionsParam === '$' && (toOptionsParam = toOptionsParsedList.at(-1))
            toOptionsParam && toOptionsParam.length>1 & toOptionsParam[0] === '$' && (toOptionsParam = toOptionsParsedList.at(toOptionsParam.slice(1)))
            toOptionsParam && typeof toOptionsParam === 'string' && (toOptionsParam = JSON.parse(toOptionsParam))
            toOptionsParam ||= {}
            toOptionsParsedList.push(toOptionsParam)
            toParams[toValueIndex] = [toValuesList[toValueIndex], toOptionsParam]
        }
        return toParams
    }},
    _attachLiveToElement: {configurable: false, enumerable: false, writable: false, value: function(element) {
        for (const subElement of element.shadowRoot.getElementsByTagName('*')) this._processAddedElement(subElement)
        this._setupObserver(element, element.shadowRoot)
    }},
    _processAddedElement: {configurable: false, enumerable: false, writable: false, value: function(element) {
        if (element.hasAttribute('b37-to')) {
            for (const toParam of this._parseToAttribute(element)) this._configureTrigger('add', element, ...toParam)
        }
        if (element.tagName.includes('-') && element.shadowRoot && element.b37Dataset) {
            this._attachLiveToElement(element)
        }
    }},
    _setupObserver: {configurable: false, enumerable: false, writable: false, value: function(observerRoot, domRoot) {
        observerRoot._b37LiveObserver ||= new MutationObserver(async mutationList => {
            for (const mutationRecord of mutationList) {
                if (mutationRecord.type === 'childList') {
                    for (const element of mutationRecord.addedNodes) this._processAddedElement(element)
                }
                if (mutationRecord.type === 'attributes') {
                    if (mutationRecord.attributeName === 'b37-to') {
                        for (const toParam of this._parseToAttribute(toElement)) this._configureTrigger('remove', toElement, ...toParam)
                        for (const toParam of this._parseToAttribute(toElement)) this._configureTrigger('add', toElement, ...toParam)
                    }
                }
            }
        })
        observerRoot._b37LiveObserver.observe(domRoot, {subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['b37-to']})
    }},
    start: {configurable: false, enumerable: true, writable: false, value: async function() {
        globalThis.requestIdleCallback ||= function(handler) {let sT = Date.now(); return globalThis.setTimeout(function() {handler({didTimeout: false, timeRemaining: function() {return Math.max(0, 50.0 - (Date.now() - sT)) }})}, 1)}
        const run = () => {
            for (const k in this.listeners) if (this.listeners[k].period) this._runListener(k)
            globalThis.requestIdleCallback(run, {options: this.maxDelay || 1000})
        }
        globalThis.requestIdleCallback(run, {options: this.maxDelay || 1000})
        for (const element of document.getElementsByTagName('*')) this._processAddedElement(element)
        this._setupObserver(this, document)


        //let's see if a mutationObserver is required for the below...
        for (const subscribedElement of document.querySelectorAll(`[b37-from]`)) this._processElement(subscribedElement, 'subscription')

    }},
    listen: {configurable: false, enumerable: true, writable: false, value: async function(key, input={}, force=false, idempotent=false, eventName=undefined, once=false, verbose=false) {
        //((input instanceof globalThis.constructor) && 'hashchange') || ((input instanceof WebSocket) && 'message')        
        let result
        if (input instanceof Event) {
            for (const d of ['detail', 'data']) {
                if (!input[d]) continue
                input[d] instanceof Object && (result = input[d]) && (t=1)
                if (typeof input[d] === 'string') try {result = ((t=1) && JSON.parse(input[d]))} catch(e) {result = ((t=1) && {[eventName]: input[d]})}
                t || (result = {[eventName]: input[d]})
            }
            result = this._runListener(key, result, force, idempotent, verbose)
        }
        if (input instanceof EventTarget) {
            eventName ||= ((input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement) && 'change')
                || ((input instanceof globalThis.constructor) && 'hashchange') || ((input instanceof WebSocket) && 'message') || 'click'
            result = input.addEventListener(eventName, event => this.listen(key, event, force, idempotent, eventName, once, verbose), {once: once}) && true
        }
        if (input instanceof Promise) result = await this._runListener(key, await Promise.resolve(input), force, idempotent, verbose)
        if (Array.isArray(input)) for (const i of input) result = await this._runListener(key, i, force, idempotent, verbose)
        result || await this._runListener(key, input, force, idempotent, verbose)
    }},


    _processElement: {configurable: false, enumerable: false, writable: false, value: function(element, type) {
            const attrName = type === 'subscription' ? 'b37-from' : 'b37-to'
            const cleanVectors = [], listAttribute = (element.getAttribute(attrName) || ''), flags = $this[`_${type}s`]
            let firstPass = false, id = element.getAttribute('b37-id'), listAttributeValueChanged
            if (!element.hasAttribute('b37-id')) {
                firstPass = true
                listAttributeValueChanged = false
                id = crypto.randomUUID()
                element.setAttribute('b37-id', id)
            } else if (!firstPass && id && flags[id] instanceof Object 
                && Object.keys(flags[id]).sort().join(' ') !== listAttribute) {
                firstPass = true
            }
            let vectorList = listAttribute.split(' ')
            if (firstPass) vectorList = vectorList.sort().filter(v => !!v)
            if (firstPass && flags[id] instanceof Object) {
                for (const vector in flags[id]) {
                    const vectorSplit = vector.split(':')
                    if (!vectorList.includes(vector)) {
                        const eventType = `${type===subscription?'b37ListenerRun-':''}${vectorSplit[0]}`, 
                            listeningElement =  type == 'subscription' ? window : element
                        listeningElement.removeEventListener(eventType, flags[id][vector])
                    }                    
                }
            }
            for (let vector of vectorList) {
                if (firstPass) {
                    const originalVector = vector
                    let colonIndex = vector.indexOf(':')
                    if (colonIndex != -1) vector = vector.replace(/:+/g, ':')
                    colonIndex = vector.indexOf(':')
                    if (colonIndex === 0) vector = vector.slice(1)
                    colonIndex = vector.indexOf(':')
                    if (colonIndex == -1) { vector = `${vector}:${vector}` } else if (colonIndex == vector.length-1) { vector = `${vector}${vector}` }
                    listAttributeValueChanged = originalVector !== vector
                    cleanVectors.push(vector)
                }
                if (!(flags[id] instanceof Object)) flags[id] = {}
                if (!flags[id][vector]) {
                    const vectorSplit = vector.split(':')
                    flags[id][vector] = async function(event) {
                        const processor = (typeof $this.processors[vectorSplit[1]] == 'object' && typeof $this.processors[vectorSplit[1]][type] == 'function') ? $this.processors[vectorSplit[1]][type] : $this.processors[vectorSplit[1]]
                        if (typeof processor !== 'function') return
                        const handlerInput =  type == 'subscription' ? {...event.detail, ...{subscriber: element}} 
                            : {...event.detail, 
                                ...{
                                    attributes: Object.assign({}, ...Array.from(element.attributes).map(a => ({[a.name]: a.value}))), 
                                    properties: {value: element.value, innerHTML: element.innerHTML, innerText: element.innerText}, 
                                    map: {
                                        ...Object.assign({}, ...Array.from(element.attributes).map(a => ({[`@${a.name}`]: a.value}))), 
                                        ...{'#value': element.value, '#innerHTML': element.innerHTML, '#innerText': element.innerText}
                                    }, 
                                    triggersource: element, 
                                    event: event,
                                    vector: vector
                                }}
                        const handledPayload = await processor(handlerInput)
                        if (!(type == 'subscription' && handledPayload instanceof Object)) return
                        for (const k in handledPayload) {
                            handledPayload[k] ?? (handledPayload[k] ||= '')
                            k && k[0] == '#' && (element[k.slice(1)] = handledPayload[k])
                            k && k[0] == '@' && element.setAttribute(k.slice(1), handledPayload[k])
                            if (!k || !'#@'.includes(k[0])) element.setAttribute(k, handledPayload[k])
                        }
                    }
                    const eventType = `${type===subscription?'b37ListenerRun-':''}${vectorSplit[0]}`, listeningElement =  type == 'subscription' ? window : element
                    listeningElement.addEventListener(eventType, flags[id][vector])
                }
            }
            firstPass && element.setAttribute(attrName, (listAttributeValueChanged?cleanVectors:vectorList).sort().join(' '))
    }}, 





    _runListener: {configurable: false, enumerable: false, writable: false, value: async function(key, input={}, force=false, idempotent=false, verbose=false) {
        const listener = this.listeners[key] || {processor: key}, processorKey = listener.processor || key, 
            processor = this.processors[processorKey]?.listener || this.processors[processorKey] || (input => input), now = Date.now()
        if (!((listener instanceof Object) && (force || (!force && !listener.expired && !listener.maxed)))) return true
        if (force || !listener.period || (listener.period && (((listener.previous || 0) + listener.period) <= now))) {
            if (!force && !listener.expired && (listener.expires && (listener.expires <= now))) {
                listener.expired = true
                globalThis.dispatchEvent(new CustomEvent(`b37ListenerExpired`, {detail: {listener: key, input: input}}))
                globalThis.dispatchEvent(new CustomEvent(`b37ListenerExpired-${key}`, {detail: {listener: key, input: input}}))
            } else {
                input = (input instanceof Object && input) || (listener.input instanceof Object && listener.input) || {}
                if (!idempotent) {
                    listener.previous = now
                    listener.count = (listener.count || 0) + 1
                    const previous = listener.previous, count = listener.count
                    listener.next = now + listener.period
                }
                const result = await processor(input)
                globalThis.dispatchEvent(new CustomEvent(`b37ListenerRun`, {detail: {listener: key, result: result}}))
                globalThis.dispatchEvent(new CustomEvent(`b37ListenerRun-${key}`, {detail: {listener: key, result: result}}))
                listener.max && !listener.maxed && (listener.count == listener.max) && (listener.maxed = true) 
                    && globalThis.dispatchEvent(new CustomEvent(`b37ListenerMaxed`, {detail: {listener: key, input: input}}))
                    && globalThis.dispatchEvent(new CustomEvent(`b37ListenerMaxed-${key}`, {detail: {listener: key, input: input}}))

                listener.expires && listener.period && ((now + listener.period) >= listener.expires) && (listener.expired = true)
                    && globalThis.dispatchEvent(new CustomEvent(`b37ListenerExpired`, {detail: {listener: key, input: input}}))
                    && globalThis.dispatchEvent(new CustomEvent(`b37ListenerExpired-${key}`, {detail: {listener: key, input: input}}))
            }
        } else if (!force && listener.period && (listener.next && (listener.next > now))) {
            if (verbose || listener.verbose) {
                globalThis.dispatchEvent(new CustomEvent(`b37-listener-passed`, {detail: {listener: key, input: input}}))
                globalThis.dispatchEvent(new CustomEvent(`b37-listener-passed-${key}`, {detail: {listener: key, input: input}}))
            }
        }
        return true
    }},







})
export { Live }