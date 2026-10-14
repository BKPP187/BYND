(function (H) {
    'use strict';
    // These masks belong only to the two reviewed meshes, in normalized rest
    // coordinates. The material expression follows skinning without floating eye patches.
    const profiles = {
        'silver-red-v1': { left: [-.040, .856], right: [.027, .861], radius: [.027, .018], mouth: [0, .815], lip: [.024, .009], front: .026, skin: ['#d9bdb9', '#dcc1bd'] },
        'bunny-blue-v1': { left: [-.044, .765], right: [.038, .768], radius: [.028, .033], mouth: [0, .720], lip: [.022, .008], front: .07, skin: ['#fce2dd', '#fbe3dd'] }
    };
    function bind(material, id, height) {
        const p = profiles[id], T = ByndHomeEngine; if (!p) return null;
        const closed = { value: 0, mouth: { value: 0 }, smile: { value: 0 }, blink: { value: 0 }, bath: { value: 0 } };
        material.onBeforeCompile = shader => {
            shader.uniforms.homeBath = closed.bath;
            shader.vertexShader='attribute float homeBathKeep;\nvarying float homeBathMask;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhomeBathMask=homeBathKeep;');
            shader.fragmentShader='uniform float homeBath;\nvarying float homeBathMask;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(homeBath>.5 && homeBathMask<.5) discard;');
            Object.assign(shader.uniforms, { homeClosed: closed, homeBlink: closed.blink, homeMouthOpen: closed.mouth, homeSmile: closed.smile, homeMouth: { value: new T.Vector2(...p.mouth) }, homeLipRadius: { value: new T.Vector2(...p.lip) }, homeSkinLeft: { value: new T.Color(p.skin[0]) }, homeSkinRight: { value: new T.Color(p.skin[1]) }, homeLeft: { value: new T.Vector2(...p.left) }, homeRight: { value: new T.Vector2(...p.right) }, homeEyeRadius: { value: new T.Vector2(...p.radius) } });
            shader.vertexShader = 'varying vec3 homeRest;\nvarying vec3 homeFaceNormal;\nuniform float homeMouthOpen, homeSmile;\nuniform vec2 homeMouth, homeLipRadius;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('#include <skinnormal_vertex>', `#include <skinnormal_vertex>
vec4 homeN = vec4(0.0, 0.0, 1.0, 0.0);
#ifdef USE_SKINNING
homeN = skinMatrix * homeN;
#endif
homeFaceNormal = normalize(normalMatrix * homeN.xyz);`);
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
homeRest = position / ${height.toFixed(6)};
vec2 homeLipQ = (homeRest.xy - homeMouth) / homeLipRadius;
float homeLipFront = smoothstep(${p.front.toFixed(6)}, ${(p.front + .008).toFixed(6)}, homeRest.z);
float homeLipWeight = (1.0 - smoothstep(.4, 2.5, dot(homeLipQ, homeLipQ))) * homeLipFront;
// Small deformations of the existing lip surface before skinning, rather than
// detached mouth overlays. These reviewed assets have no authored facial rig.
transformed.y += ${height.toFixed(6)} * homeLipWeight * (.0015 * homeMouthOpen * clamp(homeLipQ.y, -1.0, 1.0) + .002 * homeSmile * min(1.0, homeLipQ.x * homeLipQ.x));`);
            shader.fragmentShader = `varying vec3 homeRest;
varying vec3 homeFaceNormal;
uniform float homeClosed, homeBlink;
uniform float homeMouthOpen, homeSmile;
uniform vec2 homeMouth, homeLipRadius;
uniform vec3 homeSkinLeft, homeSkinRight;
uniform vec2 homeLeft, homeRight, homeEyeRadius;
float homeLid(vec2 center) {
    vec2 q = (homeRest.xy - center) / homeEyeRadius;
    float mask = 1.0 - smoothstep(.72, 1.15, dot(q, q));
    float curve = -.10 + .22 * q.x * q.x;
    float line = (1.0 - smoothstep(.016, .047, abs(q.y - curve))) * (1.0 - smoothstep(.65, .85, abs(q.x)));
    return mask * line;
}
` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
vec2 homeQL = (homeRest.xy - homeLeft) / homeEyeRadius;
vec2 homeQR = (homeRest.xy - homeRight) / homeEyeRadius;
float homeFace = smoothstep(${p.front.toFixed(6)}, ${(p.front + .008).toFixed(6)}, homeRest.z);
float homeMask = (homeClosed + (1.0 - homeClosed) * homeBlink) * homeFace * (1.0 - smoothstep(.48, 1.3, min(dot(homeQL, homeQL), dot(homeQR, homeQR))));
float homeLine = max(homeLid(homeLeft), homeLid(homeRight));
vec3 homeSkin = dot(homeQL, homeQL) < dot(homeQR, homeQR) ? homeSkinLeft : homeSkinRight;
diffuseColor.rgb = mix(diffuseColor.rgb, mix(homeSkin, vec3(.085, .045, .04), homeLine), homeMask);
vec2 homeLipUV = (homeRest.xy - homeMouth) / homeLipRadius;
float homeOralCurve = homeLipUV.y - homeSmile * .17 * homeLipUV.x * homeLipUV.x;
float homeOralMask = (1.0 - smoothstep(.62, .95, abs(homeLipUV.x))) * (1.0 - smoothstep(.12, .30, abs(homeOralCurve))) * homeFace * homeMouthOpen;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.085, .023, .024), homeOralMask * .85);
`);
            // Closed lids must lose the open eyeball's normal-map highlights too.
            shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, normalize(homeFaceNormal), homeMask));');
        };
        material.customProgramCacheKey = () => 'home-face-expression-v4-' + id;
        return closed;
    }
    function meal(actor, open = 0, smile = 0, blink = 0) {
        actor.expressions?.forEach(e => { e.mouth.value = Math.max(0, Math.min(1, open)); e.smile.value = Math.max(0, Math.min(1, smile)); e.blink.value = Math.max(0, Math.min(1, blink)); });
    }
    function eyeRest(id, height) {
        const p = profiles[id]; return p ? [(p.left[0] + p.right[0]) * .5 * height, (p.left[1] + p.right[1]) * .5 * height, (p.front + .024) * height] : [0, height * .86, .08];
    }
    H.Expressions = { bind, meal, eyeRest };
})(window.ByndHome3D);
