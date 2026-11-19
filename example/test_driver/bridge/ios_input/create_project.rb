require 'xcodeproj'
require 'fileutils'

# Build products and generated project stay in the private test directory.
destination = File.expand_path(ARGV.fetch(0))
source = ARGV[1] ? File.expand_path(ARGV[1]) : File.expand_path('TrustedInputTests.swift', __dir__)
FileUtils.mkdir_p(destination)
project_path = File.join(destination, 'TrustedInput.xcodeproj')
raise 'Existing generated project; inspect it before rebuilding' if File.exist?(project_path)
project = Xcodeproj::Project.new(project_path)
target = project.new_target(:ui_test_bundle, 'TrustedInput', :ios, '15.0')
reference = project.main_group.new_file(source)
target.source_build_phase.add_file_reference(reference)
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'dev.tmap.audit.TrustedInput',
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'INFOPLIST_KEY_NSAppTransportSecurity_NSAllowsArbitraryLoads' => 'YES',
    'SWIFT_VERSION' => '5.0',
    'CODE_SIGNING_ALLOWED' => 'NO',
    'SUPPORTED_PLATFORMS' => 'iphonesimulator',
    'TARGETED_DEVICE_FAMILY' => '1,2',
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project_path, 'TrustedInput', true)
puts project_path
