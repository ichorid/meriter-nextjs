'use client';

import { A } from '@shared/components/simple/simple-elements';
import { useState } from "react";
import { useTranslation } from 'react-i18next';

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

const Checkbox = ({ tagName, h, d, selectItem }) => {
    return (
        <div className="checkbox-wrapper">
            <label>
                <input
                    type="checkbox"
                    onChange={(e) => selectItem(tagName, e.target.checked)}
                />
                <span className="checkmark"></span>
                {h && <span className="heading">{h}</span>}
                {d && <span className="description">{d}</span>}
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
    const { t } = useTranslation('polls');
    const [expanded, setExpanded] = useState({});

    const [results, setResults] =
        resultsInit !== undefined && setResultsInit
            ? [resultsInit, setResultsInit]
            : useState({});

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
                    <A center button onClick={() => onSubmit(results)}>
                        {t('confirm')}
                    </A>
                </div>
            )}
        </div>
    );
};
