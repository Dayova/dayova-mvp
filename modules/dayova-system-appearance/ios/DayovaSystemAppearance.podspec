Pod::Spec.new do |s|
  s.name           = 'DayovaSystemAppearance'
  s.version        = '1.0.0'
  s.summary        = 'Reports the active iOS interface style to Dayova.'
  s.description    = 'Bridges the key UIWindow trait collection to JavaScript.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  # Match Expo SDK 57's baseline; the app may have a higher target because of other pods.
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'React-Core'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
