import Atlas from '@/components/atlas';
import {aggregate} from '@/lib/atlas/engine';
export default function Page(){return <Atlas initial={aggregate([],'5M',Date.now())}/>;}
