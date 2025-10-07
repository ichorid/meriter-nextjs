
export const etv = (val, setVal) => {
    return {
        value: val,
        onChange: (e) => {
            setVal(e.target.value);
        },
    };
};

