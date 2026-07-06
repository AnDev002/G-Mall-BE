export interface TagRule {
    code: string;
    group: 'recipient' | 'occasion' | 'corporate';
    label: string;
    keywords: string[];
}
export declare const AUTO_TAG_RULES: TagRule[];
