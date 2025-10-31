export const etv = (val: string, setVal: (value: string) => void) => {
    return {
        value: val,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setVal(e.target.value);
        },
    };
};
