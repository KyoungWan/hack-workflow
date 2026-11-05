"use client";
import {useEffect} from 'react';
import {mountExplorer} from '../../src/client';
import {markup} from '../../src/markup';
export default function Explorer(){
 useEffect(()=>mountExplorer(),[]);
 // Trusted bundled markup only. CSV values are inserted through textContent.
 return <div style={{display:'contents'}} dangerouslySetInnerHTML={{__html:markup}}/>;
}
