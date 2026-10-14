'use strict';
// node scripts/edit-shanghuan-debut.cjs "D:\codex-workspace\商桓pv"
// Only rendered assets are replaced; original source clips are never written.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = process.argv[2];
if (!source) throw new Error('Pass the directory containing the original Shanghuan PV clips.');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bynd-debut-edit-'));
const output = path.join(root, 'assets/characters/builtin');
const musicFile = path.join(output, 'shanghuan-debut-music.mp3');
const musicInfo = JSON.parse(fs.readFileSync(path.join(output, 'shanghuan-debut-music.json'), 'utf8'));
if (!fs.existsSync(musicFile)) throw new Error('Missing continuous replacement music.');
const opFile = 'mmexport1791374622370.mp4';
const opInfo = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames', '-of', 'json', path.join(source, opFile)], { encoding: 'utf8' }));
const opFrames = Number(opInfo.streams[0].nb_frames);
if (!Number.isInteger(opFrames) || opFrames <= 156) throw new Error('Cannot read the full OP frame count.');
const kitchenFile = 'mmexport1791552185053.mp4';
const kitchenInfo = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames,r_frame_rate', '-of', 'json', path.join(source, kitchenFile)], { encoding: 'utf8' }));
const kitchenFrames = Number(kitchenInfo.streams[0].nb_frames);
if (!Number.isInteger(kitchenFrames) || kitchenFrames < 240 || kitchenInfo.streams[0].r_frame_rate !== '24/1') throw new Error('Replacement kitchen clip must contain its complete 24fps ending.');
const transitionFrames = 9;
const soundPrelap = 0.5;
// Omit the desk-to-lab transition residue so it cannot flash back after the pen
// insert. Other OP shots remain in order; pendant detail leads into the kitchen.
const excludedSourceRanges = [
    { file: opFile, startFrame: 36, endFrameExclusive: 62, reason: 'Remove the returning ink-bottle/desk transition after the pen insert' },
    { file: 'mmexport1791293533927.mp4', startFrame: 50, endFrameExclusive: 78, reason: 'Remove the side-face flash and repeated wide plate shot before the hands accept the dish' },
    { file: 'mmexport1791293487185.mp4', startFrame: 85, endFrameExclusive: 86, reason: 'Remove the single back-view frame at the end of the plate offer' },
    { file: 'mmexport1791293423489.mp4', startFrame: 34, endFrameExclusive: 36, reason: 'Remove the two lab portrait frames before the pen shot' },
    { file: 'mmexport1791293533927.mp4', startFrame: 90, endFrameExclusive: 98, reason: 'Do not show the later meal acceptance before the Where are you going line' },
    { file: 'mmexport1791293533927.mp4', startFrame: 168, endFrameExclusive: 218, reason: 'Replace the inconsistent old frontal ending with the regenerated continuous kitchen clip' }
];
const shots = [
    { file: opFile, start: 0, frames: 36, phase: 'op', cue: 'desk-pen', sound: true, note: 'Clean desk/pen establishing shot, ending before the transition' },
    { file: 'mmexport1791293423489.mp4', start: 36 / 24, frames: 29, phase: 'op', cue: 'pen', sound: true, note: 'Complete pen action and camera push-in; omit the two preceding lab portrait frames' },
    { file: opFile, start: 62 / 24, frames: 94, phase: 'op', sound: true, note: 'Cut directly to the clean lab portrait, without the ink-bottle flash' },
    { file: 'mmexport1791293423489.mp4', start: 65 / 24, frames: 55, phase: 'op', cue: 'glasses', sound: true, note: 'Start directly on glasses removal, without returning to the earlier suit portrait' },
    { file: opFile, start: 156 / 24, frames: opFrames - 156, phase: 'op', cue: 'pendant-out', sound: true, note: 'Finish OP on the character and silver chain' },
    { file: 'mmexport1791293423489.mp4', start: 132 / 24, frames: 39, phase: 'pv', cue: 'pendant-in', sound: false, note: 'Silver chain/white shirt lead into kitchen back view' },
    { file: 'mmexport1791293368427.mp4', start: 0, frames: 44, phase: 'pv', sound: true, note: 'Arrival: cutting sounds and cooking detail' },
    { file: 'mmexport1791293368427.mp4', start: 80 / 24, frames: 39, phase: 'pv', sound: true, note: 'Cooking at natural speed' },
    { file: kitchenFile, start: 0, frames: kitchenFrames, phase: 'pv', cue: 'ending', sound: true, note: 'Preserve the regenerated cooking, meal handoff, question, washing, drying and leaning sequence continuously, including its final stay-and-eat line' }
];
const run = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
// Speech-free kitchen sound starts before the kitchen image and continues under cuts.
run(['-ss', '6.05', '-t', '1.9', '-i', path.join(source, 'mmexport1791293368427.mp4'), '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', path.join(temp, 'room.wav')]);
const opDuration = shots.filter(shot => shot.phase === 'op').reduce((sum, shot) => sum + shot.frames, 0) / 24;
const pvDuration = shots.filter(shot => shot.phase === 'pv').reduce((sum, shot) => sum + shot.frames, 0) / 24;
const transitionDuration = transitionFrames / 24;
const pvStart = opDuration - transitionDuration;
const duration = pvStart + pvDuration;
let opFrame = 0, pvFrame = 0;
for (const [index, shot] of shots.entries()) {
    const input = path.join(source, shot.file);
    if (!fs.existsSync(input)) throw new Error('Missing source clip: ' + input);
    const length = shot.frames / 24;
    const startFrame = Math.round(shot.start * 24);
    const vf = `trim=start_frame=${startFrame}:end_frame=${startFrame + shot.frames},setpts=PTS-STARTPTS,fps=24,scale=720:1280,setsar=1,format=yuv420p`;
    run(['-i', input, '-an', '-vf', vf, '-frames:v', String(shot.frames), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', path.join(temp, `shot-${index}.mp4`)]);
    if (shot.phase === 'pv') {
        // Join PCM at exactly 2,000 stereo samples per frame. Joining separate
        // AAC cuts would accumulate encoder priming and shift the later dialogue.
        const audioSource = shot.audioSource || { file: shot.file, start: shot.start };
        const audioInput = shot.sound ? ['-ss', String(audioSource.start), '-i', path.join(source, audioSource.file)] : ['-stream_loop', '-1', '-i', path.join(temp, 'room.wav')];
        const af = `aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${length},asetpts=PTS-STARTPTS,apad,atrim=end_sample=${shot.frames * 2000},afade=t=in:d=0.025,afade=t=out:st=${length - 0.035}:d=0.035${shot.sound ? '' : ',volume=0.25'}`;
        run([...audioInput, '-vn', '-af', af, '-c:a', 'pcm_s16le', path.join(temp, `shot-${index}.wav`)]);
    }
    shot.timelineStart = shot.phase === 'op' ? opFrame / 24 : pvStart + pvFrame / 24;
    shot.timelineEnd = shot.timelineStart + length;
    if (shot.phase === 'op') opFrame += shot.frames; else pvFrame += shot.frames;
}
for (const phase of ['op', 'pv']) {
    fs.writeFileSync(path.join(temp, `${phase}.txt`), shots.flatMap((shot, i) => shot.phase === phase ? [`file 'shot-${i}.mp4'`] : []).join('\n'));
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${phase}.txt`, '-an', '-c', 'copy', `${phase}.mp4`], { cwd: temp, stdio: 'inherit' });
}
fs.writeFileSync(path.join(temp, 'pv-audio.txt'), shots.flatMap((shot, i) => shot.phase === 'pv' ? [`file 'shot-${i}.wav'`] : []).join('\n'));
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'pv-audio.txt', '-c:a', 'pcm_s16le', 'pv.wav'], { cwd: temp, stdio: 'inherit' });
const roomStart = pvStart - soundPrelap;
const roomDuration = duration - roomStart;
const graph = [
    `[0:v]fps=24,trim=duration=${opDuration},settb=AVTB,setpts=N/(24*TB),format=yuv420p[opv]`,
    `[1:v]fps=24,trim=duration=${pvDuration},settb=AVTB,setpts=N/(24*TB),format=yuv420p[pvv]`,
    `[opv][pvv]xfade=transition=fade:duration=${transitionDuration}:offset=${pvStart},format=yuv420p,fade=t=out:st=${duration - 0.25}:d=0.25[v]`,
    `[2:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${duration},asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2:LRA=9,aresample=48000,volume='if(lt(t,${pvStart - 1}),0.70,if(lt(t,${pvStart}),0.70-0.48*(t-${pvStart - 1}),0.22))':eval=frame,afade=t=in:d=0.20,afade=t=out:st=${duration - 1.2}:d=1.2[score]`,
    `[4:a]atrim=duration=${pvDuration},asetpts=PTS-STARTPTS,afade=t=in:d=0.08,afade=t=out:st=${pvDuration - 0.25}:d=0.25,adelay=${Math.round(pvStart * 1000)}:all=1,apad,atrim=duration=${duration},asplit=2[dialogue][duck]`,
    '[score][duck]sidechaincompress=threshold=0.025:ratio=5:attack=20:release=250:makeup=1[duckedScore]',
    `[3:a]atrim=duration=${roomDuration},asetpts=PTS-STARTPTS,volume=0.14,afade=t=in:d=0.5,afade=t=out:st=${roomDuration - 0.3}:d=0.3,adelay=${Math.round(roomStart * 1000)}:all=1,apad,atrim=duration=${duration}[room]`,
    `[duckedScore][dialogue][room]amix=inputs=3:normalize=0,alimiter=limit=0.95:level=false:latency=true,atrim=duration=${duration}[a]`
].join(';');
run(['-i', path.join(temp, 'op.mp4'), '-i', path.join(temp, 'pv.mp4'), '-i', musicFile, '-stream_loop', '-1', '-i', path.join(temp, 'room.wav'), '-i', path.join(temp, 'pv.wav'), '-filter_complex_threads', '2', '-filter_complex', graph, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-profile:v', 'high', '-level', '3.1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-t', String(duration), path.join(temp, 'final.mp4')]);
run(['-i', path.join(temp, 'final.mp4'), '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null']);
fs.copyFileSync(path.join(temp, 'final.mp4'), path.join(output, 'shanghuan-debut.mp4'));
run(['-ss', '1', '-i', path.join(output, 'shanghuan-debut.mp4'), '-frames:v', '1', '-q:v', '3', path.join(output, 'shanghuan-debut-poster.jpg')]);
const edit = {
    fps: 24, duration, sourceClipsUnchanged: true, subtitles: [], excludedSourceRanges,
    sections: [{ phase: 'op', start: 0, end: opDuration }, { phase: 'pv', start: pvStart, end: duration }],
    transitions: [{ type: 'pen-match-cut', start: shots[1].timelineStart }, { type: 'pendant-dissolve', start: pvStart, duration: transitionDuration }],
    audio: { music: { ...musicInfo, file: 'shanghuan-debut-music.mp3', continuous: true, loops: 0, dialogueDucking: true }, originalOpMusicRemoved: true, kitchenPrelap: soundPrelap, kitchenSoundStartsAt: roomStart, originalDialogueRetained: true, joinFormat: 'PCM', samplesPerFrame: 2000 },
    replacement: { kitchenClip: kitchenFile, fullSourceFrames: kitchenFrames, continuous: true, dialogue: [{ text: '别碰我这边', sourceStart: 0.78, sourceEnd: 2.1 }, { text: '去哪儿', sourceStart: 4.04, sourceEnd: 5.12 }, { text: '就在这儿吃', sourceStart: 8.86, sourceEnd: 9.7 }] },
    shots,
    notes: 'Clean OP pen/glasses boundaries are preserved. The user-provided regenerated kitchen clip replaces the old later kitchen cuts and remains continuous from its first frame through washing, drying, leaning and the final stay-and-eat line. The old relocated invitation and inconsistent frontal ending are removed. One continuous instrumental cue bridges OP and kitchen with dialogue ducking. No subtitles, title overlay, slow motion or added freeze.'
};
fs.writeFileSync(path.join(output, 'shanghuan-debut-edit.json'), JSON.stringify(edit, null, 2) + '\n');
console.log(JSON.stringify({ file: path.join(output, 'shanghuan-debut.mp4'), duration, bytes: fs.statSync(path.join(output, 'shanghuan-debut.mp4')).size, temp, pvStart }));
