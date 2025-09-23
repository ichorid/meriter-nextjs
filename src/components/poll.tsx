import { A } from "../../frontend/simple/simple-elements";
import { useState } from "react";
import styles from "./poll.module.scss";

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
        <div className={styles.checkboxWrapper}>
            <label>
                <input
                    type="checkbox"
                    onChange={(e) => selectItem(tagName, e.target.checked)}
                />
                <span className={styles.checkmark}></span>
                {h && <span className={styles.heading}>{h}</span>}
                {d && <span className={styles.description}>{d}</span>}
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
    const [expanded, setExpanded] = useState({});

    const [results, setResults] =
        resultsInit !== undefined && setResultsInit
            ? [resultsInit, setResultsInit]
            : useState({});

    return (
        <div className={styles.poll}>
            {options.map(({ tagName, h, d, options }) => {
                const fullTag = (tagRoot ?? "") + tagName;
                return (
                    <div className={styles.pollItem} key={fullTag}>
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
                <div className={styles.submit}>
                    <A center button onClick={() => onSubmit(results)}>
                        Подтвердить
                    </A>
                </div>
            )}
        </div>
    );
};
