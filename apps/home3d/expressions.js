(function (H) {
    'use strict';
    // These masks belong only to the two reviewed meshes, in normalized rest
    // coordinates. The material expression follows skinning without floating eye patches.
    const profiles = {
        'silver-red-v1': { left: [-.040, .856], right: [.027, .861], radius: [.027, .018], front: .026, skin: ['#d9bdb9', '#dcc1bd'] },
        'bunny-blue-v1': { left: [-.044, .765], right: [.038, .768], radius: [.028, .033], front: .07, skin: ['#fce2dd', '#fbe3dd'] }
    };
    function bind(material, id, height) {
        const p = profiles[id], T = ByndHomeEngine; if (!p) return null;
        const closed = { value: 0 };
        material.onBeforeCompile = shader => {
            Object.assign(shader.uniforms, { homeClosed: closed, homeSkinLeft: { value: new T.Color(p.skin[0]) }, homeSkinRight: { value: new T.Color(p.skin[1]) }, homeLeft: { value: new T.Vector2(...p.left) }, homeRight: { value: new T.Vector2(...p.right) }, homeEyeRadius: { value: new T.Vector2(...p.radius) } });
            shader.vertexShader = 'varying vec3 homeRest;\nvarying vec3 homeFaceNormal;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('#include <skinnormal_vertex>', `#include <skinnormal_vertex>
vec4 homeN = vec4(0.0, 0.0, 1.0, 0.0);
#ifdef USE_SKINNING
homeN = skinMatrix * homeN;
#endif
homeFaceNormal = normalize(normalMatrix * homeN.xyz);`);
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nhomeRest = position / ' + height.toFixed(6) + ';');
            shader.fragmentShader = `varying vec3 homeRest;
varying vec3 homeFaceNormal;
uniform float homeClosed;
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
float homeMask = homeClosed * homeFace * (1.0 - smoothstep(.48, 1.3, min(dot(homeQL, homeQL), dot(homeQR, homeQR))));
float homeLine = max(homeLid(homeLeft), homeLid(homeRight));
vec3 homeSkin = dot(homeQL, homeQL) < dot(homeQR, homeQR) ? homeSkinLeft : homeSkinRight;
diffuseColor.rgb = mix(diffuseColor.rgb, mix(homeSkin, vec3(.085, .045, .04), homeLine), homeMask);
`);
            // Closed lids must lose the open eyeball's normal-map highlights too.
            shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, normalize(homeFaceNormal), homeMask));');
        };
        material.customProgramCacheKey = () => 'home-closed-eyes-v2-' + id;
        return closed;
    }
    H.Expressions = { bind };
})(window.ByndHome3D);
