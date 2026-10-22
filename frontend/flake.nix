{
  description = "Excavator Frontend Env";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    nixpkgs,
    flake-utils,
    ...
  }: let
    fl = flake-utils.lib;
  in
    fl.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;

        config = {
          allowUnfree = true;
        };
      };
    in {
      devShells.default = pkgs.mkShell {
        packages = with pkgs; [
          # Kotlin
          kotlin-language-server
          # DB
          mongodb-ce
        ];
      };
    });
}
