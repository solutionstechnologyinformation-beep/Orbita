import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Layout, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function Whiteboard() {
  const [selectedCrsId, setSelectedCrsId] = useState<string>("");
  const { data: crsList, isLoading } = trpc.crs.list.useQuery();

  const selectedCrs = crsList?.find((c: any) => c.id === Number(selectedCrsId));

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layout className="h-6 w-6 text-primary" />
          Quadro Branco
        </h1>
        <p className="text-muted-foreground mt-1">Espaço colaborativo para anotações e diagramas por CRS</p>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Select value={selectedCrsId} onValueChange={setSelectedCrsId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Selecione um CRS..." />
          </SelectTrigger>
          <SelectContent>
            {crsList?.map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.code ? `[${c.code}] ` : ""}{c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedCrsId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Layout className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Selecione um CRS</p>
            <p className="text-sm mt-1">Escolha um CRS para acessar o quadro branco colaborativo</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layout className="h-4 w-4" />
              {selectedCrs?.name}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  toast.info("Funcionalidade de quadro branco em desenvolvimento");
                }}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir em tela cheia
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/20 flex items-center justify-center" style={{ height: "60vh" }}>
              <div className="text-center text-muted-foreground">
                <Layout className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Quadro Branco — {selectedCrs?.name}</p>
                <p className="text-sm mt-1">Integração com ferramenta colaborativa em breve</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
