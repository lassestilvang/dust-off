import { DEFAULT_SOURCE_CODE, ANALYSIS_PROMPT_TEMPLATE } from './constants';

describe('Constants', () => {
    it('should have a default source code', () => {
        expect(DEFAULT_SOURCE_CODE).toBeDefined();
        expect(DEFAULT_SOURCE_CODE).toContain('Legacy jQuery to React Migration');
    });

    it('should have an analysis prompt template', () => {
        expect(ANALYSIS_PROMPT_TEMPLATE).toBeDefined();
        expect(ANALYSIS_PROMPT_TEMPLATE).toContain('Senior Software Architect');
    });
});
