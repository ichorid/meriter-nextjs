'use client';

import { iDimensionCatEnum, iDimensionConfig, iDimensions,iDimensionTags } from '../types/dimensions'
import { useEffect, useState } from 'react'
import { classList } from '@lib/classList';
import { useDebounce } from '@/hooks/useDebounce';
import { etv } from '@shared/lib/input-utils';
import { useTranslations } from 'next-intl';

export const FormDimensionsEditor = ({dimensions:dimenstionsInitial,dimensionConfig,level,onSave}:
    {dimensions:iDimensions,dimensionConfig:iDimensionConfig,
        level:"publication"|"comment"|"commentLvl1"|"commentLvl2"|"commentLvl3",
        onSave:(dimensions: iDimensions)=>any})=>{
            const t = useTranslations('communities');
            const [dimensions,setDimensions]=useState(dimenstionsInitial);
            const setDimension = (slug: string) => (value: any) => {
                const newDim = {...dimensions,[slug]:value};
                onSave(newDim);
                setDimensions(newDim)
            }

            const dimTagsConfig = dimensionConfig[level] as iDimensionTags;
            const dimCatEnumConfig = dimTagsConfig.dimensions;
            
            return  <div className="card bg-base-100 shadow-md dark:border dark:border-base-content/20 rounded-xl p-5 space-y-4">{Object.entries(dimCatEnumConfig).map(([dimensionSlug,dimensionProto])=>{
                const initialValue = dimensions?.[dimensionSlug];
                
                return <CatEnum key={dimensionSlug} setDimension={setDimension(dimensionSlug)} 
                    dimensionProto={dimensionProto} 
                    initialValue={initialValue} />
                    
            })}</div>
}

const CatEnum = ({dimensionProto, setDimension, initialValue}: any) => {
    const t = useTranslations('communities');
    const [tagSelected,setTagSelected] =useState(initialValue)
    const customInit = !initialValue||(dimensionProto.enum.find((e: any) => e===initialValue))?false:true;

    
    const totalEnum = customInit?[...dimensionProto.enum,initialValue]:dimensionProto.enum;
    const std = !tagSelected||totalEnum.find((t: any) => t===tagSelected)
    
    const [customTagEdit,setCustomTagEdit] =useState(false)
    const tagSelectedDebounced = useDebounce(tagSelected, 500);
    useEffect(()=>{
        setDimension(tagSelected)
    },[tagSelectedDebounced])
    

    return <div className="mb-4">
    <div className="text-sm font-medium mb-2 opacity-70">{dimensionProto.label}</div>
        <div className="flex flex-wrap gap-2">
        {(totalEnum).map((tag: any) => {
            return <span 
                key={tag}
                className={classList(
                    "badge badge-lg cursor-pointer hover:shadow-md transition-all",
                    tagSelected===tag ? "badge-primary" : "badge-ghost"
                )} 
                onClick={()=>{
                    setCustomTagEdit(false);
                    setTagSelected(tag)
                }}>{tag}</span>
        })}
        
        {!customTagEdit&&<span 
            className="badge badge-lg badge-outline cursor-pointer hover:shadow-md"
            onClick={()=>{
                setCustomTagEdit(true);
            }}>{std?t('other'):tagSelected}</span>}

        {customTagEdit&&<input 
            className="input input-bordered input-sm" 
            {...etv(tagSelected,setTagSelected)}/>}
        </div>
</div>
}