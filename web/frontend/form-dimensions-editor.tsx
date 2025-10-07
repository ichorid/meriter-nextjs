import { iDimensionCatEnum, iDimensionConfig, iDimensions,iDimensionTags } from 'projects/meriter/schema/types'
import { useEffect, useState } from 'react'
import { classList } from 'utils/classList';
import useDebounce from 'utils/debounce';
import { etv } from 'utils/input';

export const FormDimensionsEditor = ({dimensions:dimenstionsInitial,dimensionConfig,level,onSave}:
    {dimensions:iDimensions,dimensionConfig:iDimensionConfig,
        level:"publication"|"comment"|"commentLvl1"|"commentLvl2"|"commentLvl3",
        onSave:(iDimensions)=>any})=>{

           // console.log(dimensionConfig);

            const [dimensions,setDimensions]=useState(dimenstionsInitial);
            const setDimension = (slug) => (value) => {
                const newDim = {...dimensions,[slug]:value};
                onSave(newDim);
                setDimensions(newDim)
            }

            const dimTagsConfig = dimensionConfig[level] as iDimensionTags;
            const dimCatEnumConfig = dimTagsConfig.dimensions as iDimensionCatEnum;
            
            return  <div className="form-dimensions-editor">{Object.entries(dimCatEnumConfig).map(([dimensionSlug,dimensionProto])=>{
                const initialValue = dimensions?.[dimensionSlug];
                
                return <CatEnum key={dimensionSlug} setDimension={setDimension(dimensionSlug)} 
                    dimensionProto={dimensionProto} 
                    initialValue={initialValue} />
                    
            })}</div>
}

const CatEnum = ({dimensionProto,setDimension,initialValue})=>{
    const [tagSelected,setTagSelected] =useState(initialValue)
    const customInit = !initialValue||(dimensionProto.enum.find(e=>e===initialValue))?false:true;

    
    const totalEnum = customInit?[...dimensionProto.enum,initialValue]:dimensionProto.enum;
    const std = !tagSelected||totalEnum.find(t=>t===tagSelected)
    
    const [customTagEdit,setCustomTagEdit] =useState(false)
    const tagSelectedDebounced = useDebounce(tagSelected,500,true);
    useEffect(()=>{
        setDimension(tagSelected)
    },[tagSelectedDebounced])
    

    return <div className="cat-enum">
    <div className="label">{dimensionProto.label}</div>
        {(totalEnum).map(tag=>{
            return <span className={classList("clickable","tag",tagSelected===tag?'selected':undefined)} onClick={()=>{
                setCustomTagEdit(false);
                setTagSelected(tag)
            }}>{tag}</span>
        })}
        
        {!customTagEdit&&<span className={classList("clickable","tag")} onClick={()=>{
            setCustomTagEdit(true);
}}>{std?"Другое":tagSelected}</span>}

{customTagEdit&&<input className="custom-tag" {...etv(tagSelected,setTagSelected)}/>}


</div>
}