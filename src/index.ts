// utils
const fromHexString = (hexString: string) => {
    const noSpaces = hexString.replace(/\s/g, '');
    return Uint8Array.from(noSpaces.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
};

const stringToHex = (str: string) => {
    return str
        .split('')
        .map((c) => c.charCodeAt(0).toString(16))
        .join('');
};

type BWCurvePoint = {
    x: number;
    y: number;
    slope: number;
};

type BWCurveCategories = 'Envelope' | 'Lookup' | 'Periodic' | 'Sequence';

type BWCurveMetadata = {
    creator: string;
    description: string;
    tags: string[];
    category: BWCurveCategories;
};

type InternalData = {
    length: number;
};

export class BWCurve {
    private internal: InternalData;
    private metadata: BWCurveMetadata;
    private points: BWCurvePoint[];

    constructor() {
        this.points = [];
        this.internal = {
            length: 1.0,
        };
        this.metadata = {
            creator: 'Anonymous',
            category: 'Envelope',
            description: ' ',
            tags: [],
        };
        return this;
    }

    public setPoints<T>(
        points: T[],
        converter: (x: T) => Pick<Partial<BWCurvePoint>, 'slope'> & Pick<BWCurvePoint, 'x' | 'y'>
    ) {
        this.points = points.map((p) => {
            const { x, y, slope } = converter(p);
            return {
                x,
                y,
                slope: slope ?? 0.0,
            };
        });
        return this;
    }

    public spliceCurve(curve: BWCurve) {}

    get category() {
        return this.metadata.category;
    }

    public setCategory(category: BWCurveCategories) {
        this.metadata.category = category;
        return this;
    }

    get author() {
        return this.metadata.creator;
    }

    get tags() {
        return this.metadata.tags;
    }

    public setTags(tags: string[]) {
        this.metadata.tags = tags;
        return this;
    }

    public addTag(tag: string) {
        this.metadata.tags.push(tag);
        return this;
    }

    public removeTag(tag: string) {
        this.metadata.tags = this.metadata.tags.filter((t) => t !== tag);
        return this;
    }

    set author(author: string) {
        this.metadata.creator = author;
    }

    get pointCount() {
        return this.points.length;
    }

    get(index: number) {
        return this.points[index];
    }

    public addPoint(point: BWCurvePoint) {
        this.points.push(point);
        return this;
    }

    public removePoint(index: number) {
        this.points.splice(index, 1);
        return this;
    }

    public static readBuffer(buffer: Uint8Array) {
        return new BWCurve();
    }

    public writeBuffer() {
        const spacer = fromHexString('00 00 00');

        return Uint8Array.from([
            /// header
            ...fromHexString(
                '42 74 57 67 30 30 30 33 30 30 30 32 30 30 30 30 30 30 30 30 31 35 35 65 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30'
            ),
            ...spacer,
            ...fromHexString('04'),
            ...spacer,
            // meta
            ...fromHexString('04 6D 65 74 61'),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // application_version_name
            ...fromHexString('18 61 70 70 6C 69 63 61 74 69 6F 6E 5F 76 65 72 73 69 6F 6E 5F 6E 61 6D 65 08'),
            ...spacer,
            // currently 5.2.2
            ...fromHexString('05 35 2E 32 2E 32'),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // branch
            ...fromHexString('06 62 72 61 6E 63 68 08'),
            ...spacer,
            // releases
            ...fromHexString('08 72 65 6C 65 61 73 65 73'),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // comment
            ...fromHexString('07 63 6F 6D 6D 65 6E 74'),
            ...fromHexString('08'),
            ...spacer,
            ...fromHexString('U'),
            ...fromHexString(stringToHex(this.metadata.description)),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // creator
            ...fromHexString('04 74 61 67 73'),
            ...spacer,
            ...fromHexString('09'),
            ...fromHexString(stringToHex(this.metadata.creator)),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            ...fromHexString('0E'),
            // curve category
            ...fromHexString('63 75 72 76 65 5F 63 61 74 65 67 6F 72 79 08'),
            ...spacer,
            ...fromHexString('06'),
            ...fromHexString(stringToHex(this.metadata.category)),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            ...fromHexString('0A'),
        ]);
    }
}
