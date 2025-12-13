'use client';

import { A } from '@shared/components/simple/simple-elements';
import { useState } from "react";
import { useTranslations } from 'next-intl';

interface IPollProps {
    tagRoot?: string;
    options: IPollOptions[];
    results?: IPollResults;
    setResults?: (data: IPollResults) => any;
    onChange?: (tagName: string, val: any) => any;
    folded?: boolean;
    onSubmit?: Function;
}
interface IPollOptions {
    h?: string;
    d?: string;
    tagName: string;
    options?: IPollOptions[];
}
interface IPollResults {
    [tagName: string]: any;
}

interface CheckboxProps {
    tagName: string;
    h: any;
    d: any;
    selectItem: (tagName: string, checked: boolean) => void;
}

const Checkbox: React.FC<CheckboxProps> = ({ tagName, h, d, selectItem }) => {
    return (
        <div className="form-control">
            <label className="label cursor-pointer justify-start gap-2">
                <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    onChange={(e) => selectItem(tagName, e.target.checked)}
                />
                <div className="flex flex-col">
                    {h && <span className="label-text font-medium">{h}</span>}
                    {d && <span className="label-text-alt opacity-70">{d}</span>}
                </div>
            </label>
        </div>
    );
};

export const Poll = ({
    tagRoot,
    options,
    results: resultsInit,
    setResults: setResultsInit,
    onChange,
    folded,
    onSubmit,
}: IPollProps) => {
    const t = useTranslations('polls');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // Always call useState unconditionally to follow Rules of Hooks
    const [internalResults, setInternalResults] = useState<IPollResults>({});
    
    // Use controlled state if provided, otherwise use internal state
    const results = resultsInit !== undefined && setResultsInit
        ? resultsInit
        : internalResults;
    const setResults = resultsInit !== undefined && setResultsInit
        ? setResultsInit
        : setInternalResults;

    return (
        <div className="poll">
            {options.map(({ tagName, h, d, options }) => {
                const fullTag = (tagRoot ?? "") + tagName;
                return (
                    <div className="poll-item" key={fullTag}>
                        <Checkbox
                            h={h}
                            d={d}
                            tagName={fullTag}
                            selectItem={(tagName, val) => {
                                setResults({ ...results, [tagName]: val });
                                val
                                    ? setExpanded({
                                          ...expanded,
                                          [fullTag]: true,
                                      })
                                    : setExpanded({
                                          ...expanded,
                                          [fullTag]: false,
                                      });
                                onChange && onChange(tagName, val);
                            }}
                        />
                        {options && expanded[fullTag] && (
                            <Poll
                                tagRoot={fullTag}
                                results={results}
                                setResults={setResults}
                                options={options}
                                folded={true}
                            />
                        )}
                    </div>
                );
            })}
            {!folded && Object.keys(results).length > 0 && (
                <div className="submit">
                    <A center button onClick={() => onSubmit?.(results)}>
                        {t('confirm')}
                    </A>
                </div>
            )}
        </div>
    );
};
