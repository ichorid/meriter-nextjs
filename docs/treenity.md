```typescript
import {processMeta} from '@treenity'
import {types} from 'mobx-state-tree'

const processControllerMeta=({name,processFlow,processModel})=>{
    const processNode=nodeModel.create({
        processModel,name
    }).action((self)=>{
        return {processFlow,
            updateProcessFlow:(processFlow)=>{
                self.action((self)=>({processFlow}))
                self.serializedProcessFlow=processFlow.toString()
            },
            spawnProcess:(name,props)=>{
                self.addMeta(
                    processMeta({name,
                        processNode:self
                    })
                ).start(props).then((result,err)=>{
                    if(err) throw new Error(err)
                    self.removeMeta(name)
                    return result
                })
            }
        }
    }).hooks((self)=>{
        return {
            onCreate:
        }
    })
}

export default processNode;
```

```typescript
import { createMeta } from '@trennity'
import { types } from 'mobx-state-tree'

const processMeta = ({ processHandler, name }) => {
    const { processModel, processFlow } = processHandler

    const processMeta = createMeta('process', {
        name,
        processHandler,
        ...processModel,
        timeline: types.array(types.string),
        timelineCursor: types.int,
        isActive: types.bool,
        isAborted: types.bool,
    }).actions((self) => {
        return {
            start: (props) => processFlow(self)(props),
            abort: () => {
                self.isAborted = true
            },
        }
    })

    return processMeta
}
export default processMeta
```
