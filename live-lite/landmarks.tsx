/** Entry of the Landmarks page. The page is static HTML; this adds the styles and mounts the island over it. */
import '@/app/globals.css';
import '@/app/landmarks.css';
import {mountLandmarks} from '@/components/landmarks/island';

mountLandmarks();
