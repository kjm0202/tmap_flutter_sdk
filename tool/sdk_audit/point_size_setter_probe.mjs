// Invoke in the browser after loading the byte-pinned SDK. Each case supplies
// one or two numeric values from getter_inputs.json on a valid receiver; this
// is not a claim about omitted arguments, nonnumeric values or custom property
// descriptors. JavaScript mutates the receiver and returns undefined, whereas
// Dart's typed with* adapters return a new value without changing the receiver.
export function probePointSizeSetters(inputs) {
  const decode = (value) => typeof value === 'number' ? value : ({
    '-0': -0,
    NaN: NaN,
    Infinity: Infinity,
    '-Infinity': -Infinity,
  })[value.special];
  const encode = (value) => value === undefined ? { special: 'undefined' }
    : Number.isNaN(value) ? { special: 'NaN' }
    : value === Infinity ? { special: 'Infinity' }
    : value === -Infinity ? { special: '-Infinity' }
    : Object.is(value, -0) ? { special: '-0' }
    : value;
  const values = inputs.map(decode), rows = [];
  for (const type of ['Point', 'Size']) {
    const methods = type === 'Point'
      ? ['setX', 'setY', 'setValue']
      : ['setWidth', 'setHeight', 'setSize'];
    const modes = type === 'Point' ? ['raw'] : ['raw', 'sdk-constructor'];
    for (const method of methods) {
      const twoArguments = method === 'setValue' || method === 'setSize';
      for (const mode of modes) for (let a = 0; a < values.length; a++) {
        for (let b = 0; b < values.length; b++) {
          const secondCount = twoArguments ? values.length : 1;
          for (let c = 0; c < secondCount; c++) {
            const firstState = values[a], secondState = values[(a + 3) % values.length];
            const args = twoArguments ? [values[b], values[c]] : [values[b]];
            const id = `numeric-adaptation:${type}.${method}:${mode}:${a}:${b}${twoArguments ? `:${c}` : ''}`;
            const observation = {
              id,
              contract: `Tmapv3.base.${type}#${method}`,
              setupMode: mode,
              setupInput: [firstState, secondState].map(encode),
              input: args.map(encode),
            };
            let receiver;
            try {
              receiver = type === 'Point'
                ? new Tmapv3.Point(firstState, secondState)
                : mode === 'sdk-constructor'
                  ? new Tmapv3.Size(firstState, secondState)
                  : new Tmapv3.Size(0, 0);
              // Fixture setup must not call a setter that is itself under test.
              if (type === 'Size' && mode === 'raw') {
                receiver._width = firstState;
                receiver._height = secondState;
              }
            } catch (error) {
              Object.assign(observation, {
                status: 'threw',
                phase: 'setup',
                errorType: error?.name || 'Error',
                error: String(error),
              });
              rows.push(observation);
              continue;
            }
            const state = () => (type === 'Point'
              ? [receiver.x, receiver.y]
              : [receiver._width, receiver._height]).map(encode);
            observation.before = state();
            let phase = 'first-call';
            try {
              const original = receiver;
              const result = receiver[method](...args);
              const after = state();
              phase = 'repeat-call';
              const repeat = receiver[method](...args);
              Object.assign(observation, {
                status: 'observed',
                after,
                repeatAfter: state(),
                returnType: typeof result,
                repeatReturnType: typeof repeat,
                receiverRetained: original === receiver,
              });
            } catch (error) {
              Object.assign(observation, {
                status: 'threw',
                phase,
                after: state(),
                errorType: error?.name || 'Error',
                error: String(error),
              });
            }
            rows.push(observation);
          }
        }
      }
    }
  }
  return rows;
}
