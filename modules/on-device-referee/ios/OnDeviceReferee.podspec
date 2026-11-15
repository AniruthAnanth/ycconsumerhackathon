# A local Expo module: Expo's autolinking finds every folder under modules/ that has an
# expo-module.config.json, so nothing in package.json or app.json refers to this pod.
Pod::Spec.new do |s|
  s.name           = 'OnDeviceReferee'
  s.version        = '1.0.0'
  s.summary        = 'On-device proof pre-check with Apple Vision'
  s.description    = 'Classifies a captured proof photo on the device with the Vision framework. No bundled model, no network.'
  s.author         = 'Lineup'
  s.homepage       = 'https://github.com/AniruthAnanth/ycconsumerhackathon'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,swift}'
end
