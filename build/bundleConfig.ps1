#!/usr/bin/env pwsh

param(
    [Parameter(Mandatory=$true)]
    [string]$VsixPath,

    [Parameter(Mandatory=$true)]
    [string]$SiteConfigPath
)

try {
    # 1. Create a temporary directory for extraction
    if ($env:TEMP) {
        $baseTemp = $env:TEMP
    } elseif ($env:TMP) {
        $baseTemp = $env:TMP
    } else {
        $baseTemp = "/tmp"
    }
    $tempDir = Join-Path $baseTemp ([System.Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $tempDir | Out-Null

    # 2. Extract the VSIX
    Expand-Archive -Path $VsixPath -DestinationPath $tempDir

    $packageJsonPath = Join-Path $tempDir "extension/package.json"
    if (-not (Test-Path $packageJsonPath)) {
        throw "Error: package.json not found in VSIX"
    }

    $packageJsonContent = Get-Content -Path $packageJsonPath -Raw
    $packageJson = $packageJsonContent | ConvertFrom-Json

    $siteConfigContent = Get-Content -Path $SiteConfigPath -Raw
    if (-not $siteConfigContent) {
        throw "Error: site-config.json not found or empty"
    }
    $siteConfig = $siteConfigContent | ConvertFrom-Json -AsHashtable

    # 3. Backup original package.json and update it
    Copy-Item -Path $packageJsonPath -Destination (Join-Path $tempDir "extension/package.json.orig")

    if (-not $packageJson.contributes) {
        $packageJson | Add-Member -MemberType NoteProperty -Name "contributes" -Value ([pscustomobject]@{configuration = [pscustomobject]@{properties = [pscustomobject]@{}}})
    } elseif (-not $packageJson.contributes.configuration) {
        $packageJson.contributes | Add-Member -MemberType NoteProperty -Name "configuration" -Value ([pscustomobject]@{properties = [pscustomobject]@{}})
    }

    $configProperties = $packageJson.contributes.configuration.properties

    function Get-JsonSchemaType($val) {
        if ($null -eq $val) { return 'null' }
        $typeName = $val.GetType().Name
        switch ($typeName) {
            'String' { return 'string' }
            'Int32' { return 'integer' }
            'Int64' { return 'integer' }
            'Double' { return 'number' }
            'Single' { return 'number' }
            'Boolean' { return 'boolean' }
            'Hashtable' { return 'object' }
            'OrderedHashtable' { return 'object' }
            'Object[]' { return 'array' }
            'ArrayList' { return 'array' }
            default { return 'string' }
        }
    }

    foreach ($key in $siteConfig.Keys) {
        $value = $siteConfig[$key]
        Write-Host "Setting $key to $($value | ConvertTo-Json -Compress)"

        if ($configProperties.PSObject.Properties[$key]) {
            $configProperties.$key.default = $value
        } else {
            $newProperty = [pscustomobject]@{
                type = Get-JsonSchemaType $value
                default = $value
                markdownDescription = ""
            }
            $configProperties | Add-Member -MemberType NoteProperty -Name $key -Value $newProperty
        }
    }

    # 4. Add site-config.json to the VSIX folder for reference
    Copy-Item -Path $SiteConfigPath -Destination (Join-Path $tempDir "extension/site-config.json")

    # 5. Write the updated package.json
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content -Path $packageJsonPath

    # 6. Repack the VSIX
    $outputVsixPath = $VsixPath.Replace(".vsix", "-mod.vsix")
    if (Test-Path $outputVsixPath) {
        Remove-Item $outputVsixPath
    }
    Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $outputVsixPath

    Write-Host "Successfully modified VSIX. New file is at: $outputVsixPath"

} finally {
    # 7. Clean up the temporary directory
    if ($tempDir -and (Test-Path $tempDir)) {
        Remove-Item -Recurse -Force -Path $tempDir
    }
}
