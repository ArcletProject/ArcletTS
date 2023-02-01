// LruCache, using a doubly linked list

class DoubleLinkedListNode<K, V> {
  key: K | undefined;
  value: V | undefined;
  prev: DoubleLinkedListNode<K, V> | null;
  next: DoubleLinkedListNode<K, V> | null;

  constructor(key?: K, value?: V) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class DoubleLinkedList<K, V> {
  head: DoubleLinkedListNode<K, V>;
  tail: DoubleLinkedListNode<K, V>;

  constructor() {
    this.head = new DoubleLinkedListNode();
    this.tail = new DoubleLinkedListNode();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  toHead(node: DoubleLinkedListNode<K, V>) {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  add(node: DoubleLinkedListNode<K, V>) {
    let prev = this.tail.prev;
    prev!.next = node;
    node.prev = prev;
    node.next = this.tail;
    this.tail.prev = node;
  }

  remove(node: DoubleLinkedListNode<K, V>): K {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
    return node.key as K;
  }

  removeTail(): K | undefined {
    if (this.tail.prev === this.head || this.head.next === this.tail) {
      return undefined;
    }
    return this.remove(this.tail.prev!);
  }
}

class LruCache<K, V> {
  capacity: number;
  map: Map<K, DoubleLinkedListNode<K, V>>;
  list: DoubleLinkedList<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.map = new Map();
    this.list = new DoubleLinkedList();
  }

  get(key: K): V | undefined
  get<T>(key: K, defaultValue: T): V | T
  get(key: K, defaultValue?: any) {
    let node = this.map.get(key);
    if (node) {
      this.set(key, node.value as V);
      return node.value;
    }
    return defaultValue;
  }

  set(key: K, value: V) {
    if (this.map.has(key)) {
      const node = this.map.get(key)!;
      node.value = value;
      this.list.remove(node);
      this.list.toHead(node);
    } else {
      if (this.map.size >= this.capacity) {
        const k = this.list.removeTail();
        if (k) {
          this.map.delete(k);
        }
      }
      const node = new DoubleLinkedListNode(key, value);
      this.map.set(key, node);
      this.list.toHead(node);
    }
  }

  [Symbol.iterator](): Iterator<[K, V]> {
    let node = this.list.head.next;
    let end = this.list.tail;
    return {
      next: (...args: []) => {
        if (node === end) {
          return {
            done: true,
            value: undefined
          }
        } else {
          let value: [K, V] = [node!.key as K, node!.value as V];
          node = node!.next;
          return {
            done: false,
            value: value
          }
        }
      }
    }
  }


  delete(key: K) {
    let node = this.map.get(key);
    if (node) {
      this.list.remove(node);
      this.map.delete(key);
    }
  }

  size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
    this.list = new DoubleLinkedList();
  }

  has(key: K) {
    return this.map.has(key);
  }

  get length() {
    return this.map.size;
  }

  get recent(): V | null {
    if (this.list.head.next === this.list.tail) {
      return null;
    }
    return this.list.head.next!.value as V;
  }

  keys() {
    return this.map.keys();
  }

  values() {
    return this.map.values();
  }

  entries() {
    return this.map.entries();
  }
}
