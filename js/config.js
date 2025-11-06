(() => {
  function makePolicy(overrides = {}) {
    const base = {
      specVersion: 'v1.4',
      policyVersion: 'windowed-dates-v1',
      windowISO: '2025-11',
      startISO: '2025-11-01',
      endISO:   '2025-11-30',
    };
    return Object.freeze(Object.assign({}, base, overrides));
  }

  window.makePolicy = makePolicy;
  window.POLICY = makePolicy();

  window.RECIPIENT_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAjn7dq75qMI7NuDhBJY2r
cJTnxpbjfZBJ4lVK/8DemwcxLTTJ6Yo4wbxQCSGCIqYkH3V8mhgfh1+2haqVXRIp
9bNl+8vL9V9J4ZQ4D6d2/BaeoQ4sJjMGJTCgsbUyKYxyVK5pmPaKVZVTzVxe1Tsr
05wWPUo+GUnUeEm968KboSNMHmQMR3OtFT01HUJET0AJm5zJrl98JVR1BNwPXi4M
ofsyYECVDbchiGsMwtwtg0dJBrkUhYh+XduBQD91HI0YmwYYX5L4G0FWCYoTtVah
OhS/jBOFoYTIyEhuDYFaByRSBe+DVzdHcX1+bS+n543bJ0Xyseq0tEMZhVHiv/db
naO/fOsgsIP5DpawxpuWVGY/rrzVSFwNsTUCFSRvuzbOIqcx2W2hGyNsVhlGJAUG
EnA6kWY2HfmPMunDKa8rd9t/8vW49o3Zx+33T9D6vXg6wI/MRe7H6iOekf0mFi4K
2wl0Zvc/wLwrnRYKAU0jw8JQKr+ZnLjaih2UnyL43w+jbOZ62+YYd3QRhBpzu+ZW
OXZWFEH4ZtzQW27TSA54hU/BS6YcXCxAzb2YvaGbD0gMYUGywCo4LlNZm4avYZ+T
ZQjzTr4DmPQtwmkLgru8TIx2kuoGHv9Vk0UYPyD+pkpUT9GtVJVukSb5pWeGWUIr
F7hUi3tDiBfBJkRfna5KFZcCAwEAAQ==
-----END PUBLIC KEY-----
`;

  window.ENC_SCHEME = 'rsa-oaep+aesgcm+deflate';
  window.ENC_SCHEME_VERSION = 'v1';
})();
