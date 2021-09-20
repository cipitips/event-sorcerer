import {createInMemoryMessageDispatcher} from '../main';
import {Promises} from '@smikhalevski/stdlib';

describe('createMemoryMessageBus', () => {

  test('consumer receives a produced message', async () => {
    const consumer = jest.fn();

    const messageBus = createInMemoryMessageDispatcher(consumer);

    await messageBus.dispatch('foo');

    expect(consumer).toHaveBeenCalledTimes(1);
    expect(consumer).toHaveBeenNthCalledWith(1, 'foo');

    await messageBus.dispatch('bar');

    expect(consumer).toHaveBeenCalledTimes(2);
    expect(consumer).toHaveBeenNthCalledWith(2, 'bar');
  });

  test('slow consumer receives messages in the order they were produced', async () => {
    const consumer = jest.fn((message) => Promises.sleep(10));

    const messageBus = createInMemoryMessageDispatcher(consumer);

    messageBus.dispatch('foo');
    messageBus.dispatch('bar');
    messageBus.dispatch('baz');

    await Promises.sleep(200);

    expect(consumer).toHaveBeenCalledTimes(3);
    expect(consumer).toHaveBeenNthCalledWith(1, 'foo');
    expect(consumer).toHaveBeenNthCalledWith(2, 'bar');
    expect(consumer).toHaveBeenNthCalledWith(3, 'baz');
  });
});
