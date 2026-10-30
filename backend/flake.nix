{
  description = "Excavator Backend Env";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    nixpkgs-new.url = "github:NixOS/nixpkgs/24ef39abb78b9071e924cfd40fa74f569bd915b2";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    nixpkgs,
    nixpkgs-new,
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

      pkgs-new = import nixpkgs-new {inherit system;};
    in {
      devShells.default = pkgs.mkShell {
        packages = with pkgs; [
          # TS
          pkgs-new.nodejs_22
          typescript
          typescript-language-server
          # DB
          mongodb-ce
        ];
      };
    });
}
