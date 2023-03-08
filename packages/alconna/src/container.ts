import * as crypt from "crypto-browserify";
import { Arg } from "./args";
import { Option, Subcommand } from "./base";
import { config } from "./config";
import { NullMessage } from "./errors";
import { DataCollection } from "./typing";
import { splitOnce, split } from "./util";

const cache: Map<string, Map<string, any>> = new Map();

export class DataCollectionContainer<DC extends DataCollection<any> = DataCollection<any>> {
  context: Arg<any> | Subcommand | Option | null;
  currentIndex: number;
  nData: number;
  bakData: any[];
  rawData: any[];
  tempData: Map<string, any>;
  tempToken: number;

  constructor(
    public preprocessors: Map<string, (_:any)=>any> = new Map(),
    public toText: (unit: any) => string | null = (unit: any) => {return typeof unit === "string" ? unit : null},
    public separators: string[] = [" "],
    public filterOut: string[] = [],
    public defaultSeparate: boolean = true,
    public filterCRLF: boolean = true,
    public cacheMessage: boolean = true,
    public paramIds: Set<string> = new Set(),
  ) {
    this.preprocessors = preprocessors;
    this.toText = toText;
    this.separators = separators;
    this.filterOut = filterOut;
    this.defaultSeparate = defaultSeparate;
    this.filterCRLF = filterCRLF;
    this.cacheMessage = cacheMessage;
    this.paramIds = paramIds;

    this.context = null;
    [this.currentIndex, this.nData, this.tempToken] = [0, 0, 0];
    [this.bakData, this.rawData] = [[], []];
    this.tempData = new Map();

    if (cache.has(this.constructor.name)) {
      let cacheMap = cache.get(this.constructor.name)!;
      for (let [key, value] of cacheMap.get("preprocessors") || {}) {
        this.preprocessors.set(key, value);
      }
      this.toText = cacheMap.get("toText") || this.toText;
      this.filterOut.push(...(cacheMap.get("filterOut") || []));
    }
  }

  static config(
    name: string,
    preprocessors: Map<string, (_:any)=>any> = new Map(),
    toText: (unit: any) => string | null = (unit: any) => {return typeof unit === "string" ? unit : null},
    separators: string[] = [" "],
  ) {
    let cacheMap = cache.get(name) || new Map();
    cacheMap.set("preprocessors", preprocessors);
    cacheMap.set("toText", toText);
    cacheMap.set("separators", separators);
    cache.set(name, cacheMap);
  }

  reset() {
    this.context = null;
    [this.currentIndex, this.nData, this.tempToken] = [0, 0, 0];
    [this.bakData, this.rawData] = [[], []];
    this.tempData = new Map();
  }

  generateToken(data: (any|string[])[]): number {
    // calculate hashcode of stringfy data using createHash
    let stringData = JSON.stringify(data);
    let hash = crypt.createHash("sha256");
    hash.update(stringData, "utf8");
    return parseInt(hash.digest("hex"), 16);
  }

  get origin(): DC {
    return this.tempData.get("origin") || "None";
  }

  get done() {
    return this.currentIndex >= this.nData;
  }

  build(data: DC): this {
    this.reset();
    this.tempData.set("origin", data);
    if (typeof data === "string") {
      //@ts-ignore
      data = [data]
    }
    let [i, err, raw] = [0, null, this.rawData];
    for (let unit of data) {
      let uname = unit.constructor.name
      if (this.filterOut.includes(uname)) {
        continue;
      }
      if (this.preprocessors.has(uname)) {
        let proc = this.preprocessors.get(uname)!
        let res = proc(unit)
        if (res) {
          unit = res
        }
      }
      let text: string = this.toText(unit) || ""
      if (text) {
        let res = text.trim()
        if (!res) {
          continue
        }
        raw.push(res)
      } else {
        raw.push(unit)
      }
      i++;
    }
    if (i < 1) {
      throw new NullMessage(config.lang.replaceKeys("analyser.handle_null_message", {target: data}))
    }
    this.nData = i
    this.bakData = Array.from(raw)
    if (this.cacheMessage) {
      this.tempToken = this.generateToken(raw)
    }
    return this
  }

  rebuild(...data: any[]):this {
    this.rawData = Array.from(this.bakData)
    for(let i = 0; i < data.length; i++) {
      let d = data[i]
      if (!d) {
        continue;
      }
      if (typeof d == "string" && i > 0 && typeof this.rawData.at(-1) == "string") {
        this.rawData[this.rawData.length - 1] += `${this.separators[0]}${d}`
      } else {
        this.rawData.push(d)
        this.nData ++
      }
    }
    this.currentIndex = 0
    this.bakData = Array.from(this.rawData)
    if(this.cacheMessage) {
      this.tempToken = this.generateToken(this.rawData)
    }
    return this;
  }

  popitem(separate: string[] | null = null, move: boolean = true): [any, boolean] {
    if (this.tempData.has('sep')){
      this.tempData.delete('sep')
    }
    if (this.currentIndex == this.nData) {
      return ["", true]
    }
    separate = separate || this.separators
    let currentData = this.rawData[this.currentIndex]
    if (typeof currentData === "string") {
      let [text, rest] = splitOnce(currentData, separate, this.filterCRLF)
      if (move) {
        if (rest) {
          this.tempData.set('sep', separate)
          this.rawData[this.currentIndex] = rest
        } else {
          this.currentIndex++
        }
      }
      return [text, true]
    }
    if (move) {
      this.currentIndex ++
    }
    return [currentData, false]
  }

  pushback(data: any, replace: boolean = false) {
    if (data == null || data == '') {
      return
    }
    if (this.tempData.has('sep')) {
      let currentData = this.rawData[this.currentIndex]
      this.rawData[this.currentIndex] = `${data}${this.tempData.get('sep')![0]}${currentData}`
      return
    }
    if (this.currentIndex >= 1) {
      this.currentIndex--;
    }
    if (replace) {
      this.rawData[this.currentIndex] = data;
    }
  }

  release(separate: string[] | null = null, recover: boolean = false) {
    let result: any[] = []
    let data = recover ? this.bakData : this.rawData.slice(this.currentIndex)
    for (let _data of data) {
      if (typeof _data == "string") {
        result.push(...split(_data, separate || [" "]))
      } else {
        result.push(_data)
      }
    }
    return result
  }

  dataSet(): [any[], number] {
    return [Array.from(this.rawData), this.currentIndex]
  }

  dataReset(data: any[], index: number) {
    this.rawData = data
    this.currentIndex = index
  }
}
