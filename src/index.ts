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

const calculateCurveBetweenPoints = (x: number, p1: BWCurvePoint, p2: BWCurvePoint) => {
    if (Math.abs(p1.slope) < 0.002) {
        return (p2.y - p1.y) / (p2.x - p1.x);
    } else {
        //TODO implement de casteljau
    }
};

export type BWCurvePoint = {
    x: number;
    y: number;
    slope: number;
};

export type BWCurveCategories = 'Envelope' | 'Lookup' | 'Periodic' | 'Sequence';

type BWCurveMetadata = {
    creator: string;
    description: string;
    name: string;
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

    /**
     * Creates a new BWCurve
     *
     * @returns {BWCurve} The new curve with default values
     */
    constructor() {
        this.points = [];
        this.internal = {
            length: 1.0,
        };
        this.metadata = {
            name: 'default',
            creator: 'default',
            category: 'Envelope',
            description: 'default',
            tags: ['default'],
        };
        return this;
    }

    /**
     * sets all points to the given points, after applying the converter function
     * @param points The points to set
     * @param converter The converter function to apply to each point
     * @returns {BWCurve}
     */
    public setPoints<T>(
        points: T[],
        converter: (
            x: T,
            idx: number,
            array: T[]
        ) => Pick<Partial<BWCurvePoint>, 'slope'> & Pick<BWCurvePoint, 'x' | 'y'>
    ) {
        this.points = points.map((p, idx, array) => {
            const { x, y, slope } = converter(p, idx, array);
            return {
                x,
                y,
                slope: slope ?? 0.0,
            };
        });
        return this;
    }

    private getMaxX() {
        return Math.max(...this.points.map((p) => p.x));
    }

    private getMaxY() {
        return Math.max(...this.points.map((p) => p.y));
    }

    private getMinX() {
        return Math.min(...this.points.map((p) => p.x));
    }

    private getMinY() {
        return Math.min(...this.points.map((p) => p.y));
    }

    /**
     * Maps over the points of the curve and applies the callback
     * @param callback The callback to apply to each point
     * @returns {BWCurve}
     */
    public map(callback: (point: BWCurvePoint, index: number, array: BWCurvePoint[]) => BWCurvePoint) {
        this.points = this.points.map(callback);
        return this;
    }

    /**
     * Clamps the curve to the range of 0.0 to 1.0 for y and -1.0 to 1.0 for slope
     * Convenience method to ensure that the curve is in the correct range and can be loaded by Bitwig
     * @returns {BWCurve}
     */
    public clamp() {
        return this.map((p) => {
            return {
                ...p,
                y: Math.max(0.0, Math.min(1.0, p.y)),
                slope: Math.max(-1, Math.min(1, p.slope)),
            };
        });
    }

    /**
     * Filters the points of the curve based on the callback
     * @param callback The callback to filter the points
     * @returns {BWCurve}
     *
     */
    public filter(callback: (point: BWCurvePoint, index: number, array: BWCurvePoint[]) => boolean) {
        this.points = this.points.filter(callback);
        return this;
    }

    /**
     * Scales the y values of the curve by the given factor
     * @param factor
     * @returns {BWCurve}
     */
    public scaleY(factor: number) {
        this.points = this.points.map((p) => {
            return {
                ...p,
                y: p.y * factor,
            };
        });
        return this;
    }

    /**
     * Scales the x values of the curve by the given factor
     * @param factor
     * @returns {BWCurve}
     */
    public scaleX(factor: number) {
        this.points = this.points.map((p) => {
            return {
                ...p,
                x: p.x * factor,
            };
        });
        return this;
    }

    /**
     * fits the curve into the given x range, so that the curve starts at min and ends at max
     * @param min
     * @param max
     * @returns {BWCurve}
     */
    public fitInXRange(min: number, max: number) {
        const minX = this.getMinX();
        this.points = this.points.map((p) => {
            return {
                ...p,
                x: p.x - minX,
            };
        });
        const maxX = this.getMaxX();
        const factor = (max - min) / maxX;
        return this.scaleX(factor);
    }

    /**
     * fits the curve into the given y range, so that the curve starts at min and ends at max
     * @param min
     * @param max
     * @returns {BWCurve}
     */
    public fitInYRange(min: number, max: number) {
        const minY = this.getMinY();
        this.points = this.points.map((p) => {
            return {
                ...p,
                y: p.y - minY,
            };
        });
        const maxY = this.getMaxY();
        const factor = (max - min) / maxY;
        return this.scaleY(factor);
    }

    /**
     * Convenience method to concatenate two Curves
     * @param curve
     * @returns {BWCurve}
     */
    public spliceCurve(curve: BWCurve) {
        if (curve.points.length === 0) {
            return this;
        }
        if (this.points.length === 0) {
            this.points = curve.points;
            return this;
        }
        const maxX = this.getMaxX();

        const pointsWithOffset = curve.points.map((p) => {
            return {
                ...p,
                x: p.x + maxX,
            };
        });

        return this.pushPoints(pointsWithOffset);
    }

    /**
     * Adds the given points to the curve
     * @param points
     * @returns {BWCurve}
     */
    public pushPoints(...points: (BWCurvePoint | BWCurvePoint[])[]) {
        points.forEach((point) => {
            if (Array.isArray(point)) {
                this.points.push(...point);
            } else {
                this.points.push(point);
            }
        });
        return this;
    }

    public shiftX(offset: number) {
        this.points = this.points.map((p) => {
            return {
                ...p,
                x: p.x + offset,
            };
        });
        return this;
    }

    /**
     * Inserts a point at the given x position
     * @param {BWCurvePoint} point
     * @returns {BWCurve}
     */
    public insertPointAtX({ x, y, slope }: BWCurvePoint) {
        const index = this.points.findIndex((p) => p.x > x);

        if (index === -1) {
            return this.pushPoints({ x, y, slope });
        }

        this.points.splice(index, 0, { x, y, slope });
        return this;
    }

    /**
     * Sorts the points of the curve by x. Should not be necessary, but can be useful
     * @returns {BWCurve}
     */
    public sort() {
        this.points.sort((a, b) => a.x - b.x);
        return this;
    }

    /**
     * Reverses the curve
     * @returns {BWCurve}
     */
    public reverse() {
        const maxX = this.getMaxX();
        this.points = this.points.reverse().map((p) => {
            return {
                ...p,
                x: maxX - p.x,
            };
        });
        return this;
    }

    /**
     * Inverts the curve
     * @returns {BWCurve}
     */
    public invert() {
        const maxY = this.getMaxY();
        for (let i = 0; i < this.points.length; i++) {
            this.points[i].y = maxY - this.points[i].y;
        }
        return this;
    }

    /**
     * Scales the curve by 0.5 and splices it with itself
     * @returns {BWCurve}
     */
    public double() {
        if (this.points.length <= 1) {
            return this;
        }
        const maxX = this.getMaxX();
        this.scaleX(0.5 * maxX);
        return this.spliceCurve(this);
    }

    /**
     * Scales the curve by 0.5 and splices it with its mirror
     * @returns {BWCurve}
     */
    public mirror() {
        if (this.points.length <= 1) {
            return this;
        }
        const maxX = this.getMaxX();
        this.scaleX(0.5);
        const clone = this.clone().reverse();
        return this.spliceCurve(clone);
    }

    /**
     * Applies the given function n times
     * @param n
     * @param f (curve: BWCurve) => BWCurve
     * @returns {BWCurve}
     */
    public repeat(n: number, f: (curve: BWCurve) => BWCurve) {
        let curve: BWCurve = this;
        for (let i = 0; i < n; i++) {
            curve = f(curve);
        }
        return curve;
    }

    /**
     * clips the curve using the given algorithm
     * @param algorithm one of 'tanh', 'sin', 'cubic'
     */
    public clip(algorithm: 'tanh' | 'sin' | 'cubic') {
        switch (algorithm) {
            case 'tanh':
                return this.map((p) => {
                    return {
                        ...p,
                        y: Math.tanh(5 * p.y),
                    };
                });
            case 'sin':
                return this.map((p) => {
                    return {
                        ...p,
                        y: Math.abs(p.y) > 2 / 3 ? Math.sign(p.y) : Math.sin((3 * Math.PI * p.y) / 4),
                    };
                });
            case 'cubic':
                return this.map((p) => {
                    return {
                        ...p,
                        y: Math.abs(p.y) > 2 / 3 ? Math.sign(p.y) : (9 * p.y) / 4 - (27 * p.y ** 3) / 16,
                    };
                });
            default:
                return this;
        }
    }

    /**
     * Gets the number of points in the curve
     * @returns {number}
     */
    get pointCount() {
        return this.points.length;
    }

    /**
     * Gets a point at a given index
     * @returns {BWCurvePoint}
     */
    get(index: number) {
        return this.points[index];
    }

    /**
     * Removes a point at a given index
     * @param index
     * @returns {BWCurve}
     */
    public removePoint(index: number) {
        this.points.splice(index, 1);
        return this;
    }

    /**
     * Gets the category of the curve
     * @returns {BWCurveCategories}
     */
    get category() {
        return this.metadata.category;
    }

    /**
     * Sets the category of the curve
     * @param category
     * @returns {BWCurve}
     */
    public setCategory(category: BWCurveCategories) {
        this.metadata.category = category;
        return this;
    }

    /**
     * Gets the creator of the curve
     * @returns {string}
     */
    get creator() {
        return this.metadata.creator;
    }

    /**
     * Sets the creator of the curve
     * @param creator must be at most 256 characters long
     * @returns {BWCurve}
     */
    setCreator(creator: string) {
        this.metadata.creator = creator;
        return this;
    }

    /**
     * Gets the name of the curve
     * @returns {string} must be at most 256 characters long
     */
    get name() {
        return this.metadata.name;
    }

    /**
     * Sets the name of the curve
     * @param name must be at most 256 characters long
     * @returns {BWCurve}
     */
    setName(name: string) {
        this.metadata.name = name;
        return this;
    }

    /**
     * Gets the tags of the curve
     * @returns {string[]}
     */
    get tags() {
        return this.metadata.tags;
    }

    /**
     * Sets the tags of the curve
     * @param tags
     * @returns {BWCurve}
     */
    public setTags(tags: string[]) {
        this.metadata.tags = tags;
        return this;
    }

    /**
     * Adds a tag to the curve
     * @param tag
     * @returns {BWCurve}
     */
    public addTag(tag: string) {
        this.metadata.tags.push(tag);
        return this;
    }

    /**
     * Removes a tag from the curve
     * @param tag
     * @returns {BWCurve}
     */
    public removeTag(tag: string) {
        this.metadata.tags = this.metadata.tags.filter((t) => t !== tag);
        return this;
    }

    /**
     * Gets the description of the curve
     * @returns {string}
     *
     */
    public get description() {
        return this.metadata.description;
    }

    /**
     * Sets the description of the curve
     * @param description
     * @returns {BWCurve}
     */
    public setDescription(description: string) {
        this.metadata.description = description;
        return this;
    }

    /**
     * Clones the curve
     * @returns {BWCurve}
     */
    public clone(): BWCurve {
        const curve = new BWCurve();
        curve.metadata = structuredClone(this.metadata);
        curve.points = structuredClone(this.points);
        return curve;
    }

    public static fromBuffer(buffer: Uint8Array) {
        throw new Error('Not implemented (yet)');
        // return new BWCurve();
    }

    /**
     * Converts the curve to a buffer
     * @returns {Uint8Array} The buffer representation of the
     * curve
     * @example
     * const curve = new BWCurve();
     * const buffer = curve.toBuffer();
     * console.log(buffer);
     * // Uint8Array(....)
     * // 42 74 57 67 30 30 30 33 30 30 30 32 30 30 30 30 30 30 30 30 31 35 30 65
     */
    public toBuffer() {
        const spacer = fromHexString('00 00 00');
        const stop = fromHexString('00');

        let points: Uint8Array[] = this.points.map(({ x, y, slope }) => {
            let structure = new Uint8Array([
                ...fromHexString('00 12 7E 00 00 35 FD 07'),
                // fill with big endian double y
                ...new Uint8Array(8),
                ...fromHexString('00 00 35 FE 07'),
                // fill with big endian double x
                ...new Uint8Array(8),
                ...fromHexString('00 00 35 FF 07'),
                // fill with big endian double slope
                ...new Uint8Array(8),

                ...fromHexString('00 00 00 00 00'),
            ]);

            const dataView = new DataView(structure.buffer);
            dataView.setFloat64(8, y, false);
            dataView.setFloat64(21, x, false);
            dataView.setFloat64(34, slope, false);
            return structure;
        });

        let pointsLength = 0;
        points.forEach((p) => (pointsLength += p.length));

        const mergedPoints = new Uint8Array(pointsLength);
        let offset = 0;
        points.forEach((p) => {
            mergedPoints.set(p, offset);
            offset += p.length;
        });

        return Uint8Array.from([
            /// header
            ...fromHexString(
                '42 74 57 67 30 30 30 33 30 30 30 32 30 30 30 30 30 30 30 30 31 35 30 65 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30 30'
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
            ...fromHexString(this.metadata.description.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.description)),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // creator
            ...fromHexString('07 63 72 65 61 74 6F 72 08'),
            ...spacer,
            ...fromHexString(this.metadata.creator.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.creator)),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            ...fromHexString('0E'),
            // curve category
            ...fromHexString('63 75 72 76 65 5F 63 61 74 65 67 6F 72 79 08'),
            ...spacer,
            ...fromHexString(this.metadata.category.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.category)),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            ...fromHexString('0A'),
            // curve_kind
            ...fromHexString('63 75 72 76 65 5F 6B 69 6E 64 01 02'),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // revision_id
            ...fromHexString('0B 72 65 76 69 73 69 6F 6E 5F 69 64 08'),
            ...spacer,
            // long string of numbers
            ...fromHexString(
                '28 31 64 39 35 34 37 37 33 36 65 34 32 35 37 64 36 61 61 37 64 33 34 66 39 66 64 64 39 62 38 63 34 66 39 39 38 34 61 36 30'
            ),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // revision_no
            ...fromHexString('0B 72 65 76 69 73 69 6F 6E 5F 6E 6F 03 00 02 45 A0'),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // tags
            ...fromHexString('04 74 61 67 73 08'),
            ...spacer,
            ...fromHexString(
                this.tags.length === 0
                    ? '00'
                    : this.tags
                          //stop byte, count only as one character
                          .join('0')
                          .length.toString(16)
            ),
            ...fromHexString(this.tags.map((t) => stringToHex(t)).join('20')),
            ...spacer,
            ...fromHexString('01'),
            ...spacer,
            // type (MIME)
            ...fromHexString('04 74 79 70 65 08'),
            ...spacer,
            // application/bitwig-curve
            ...fromHexString('18 61 70 70 6C 69 63 61 74 69 6F 6E 2F 62 69 74 77 69 67 2D 63 75 72 76 65'),
            ...spacer,
            ...fromHexString('00'),
            ...fromHexString('20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 20 0A'),
            ...fromHexString('00'),
            // points list declaration and deserilization information
            ...fromHexString(
                '00 12 7F 00 00 36 2D 01 02 00 00 36 46 05 01 00 00 36 01 01 20 00 00 36 02 01 01 00 00 36 35 01 00 00 00 36 03 12 00'
            ),
            ...mergedPoints,
            // points list end
            ...fromHexString('00 00 03 00 00 37 88 01 FF 00 00 36 65 01 FF 00 00 36 66 01 FF 00'),
            // creator
            ...fromHexString('00 36 0B 08'),
            ...spacer,
            // curve name
            ...fromHexString(this.metadata.name.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.name)),
            ...stop,
            ...fromHexString('00 36 21 08'),
            ...spacer,
            // creator
            ...fromHexString(this.metadata.creator.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.creator)),
            ...stop,
            ...fromHexString('00 36 23 08'),
            ...spacer,
            ...fromHexString(this.metadata.description.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.description)),
            ...stop,
            ...fromHexString('00 36 22 08'),
            ...spacer,
            ...fromHexString(this.metadata.category.length.toString(16)),
            ...fromHexString(stringToHex(this.metadata.category)),
            ...stop,
            ...fromHexString('00 36 A6 08'),
            ...spacer,
            ...fromHexString(
                this.tags.length === 0
                    ? '00'
                    : this.tags
                          //stop byte, count only as one character
                          .join('0')
                          .length.toString(16)
            ),
            ...fromHexString(this.tags.map((t) => stringToHex(t)).join('20')),
            ...stop,
            ...spacer,
        ]);
    }
}
